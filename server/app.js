import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createStore } from './store.js';

const MAX_EXPORT_BYTES = 3 * 1024 * 1024;
const EXPORT_NAME = /^AJ-IT-Solution-[a-z0-9-]{1,80}\.(pdf|csv|html)$/;

const visitorSchema = z.object({
  id: z.string().uuid(),
  email: z.string().trim().email().max(254).optional(),
  via: z.enum(['email', 'account']),
});

// Server copies must be what the client generates: a real PDF, or UTF-8 text with no binary bytes.
function looksLikeExport(name, buf) {
  if (name.endsWith('.pdf')) return buf.subarray(0, 5).toString('latin1') === '%PDF-';
  if (buf.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, status, error) => res.status(status).json({ success: false, error });

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * @param {{ dataDir: string, adminToken?: string, clientDir?: string, trustProxy?: string|boolean, logger?: Pick<Console,'error'> }} opts
 */
export function createApp({ dataDir, adminToken, clientDir, trustProxy = false, logger = console }) {
  const store = createStore(dataDir);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }));

  const limiter = (windowMs, limit, extra = {}) => rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (req, res) => fail(res, 429, 'Too many requests, try again later'), ...extra });
  const readLimit = limiter(60_000, 120);
  const visitorLimit = limiter(60_000, 20);
  const visitorGlobalLimit = limiter(60_000, 300, { keyGenerator: () => 'all' });
  const exportLimit = limiter(60_000, 6);
  const adminFailLimit = limiter(15 * 60_000, 10, { skipSuccessfulRequests: true });

  const checkAdmin = (req, res, next) => {
    const token = req.get('x-admin-token');
    if (!adminToken) return fail(res, 404, 'Owner access is not configured');
    if (!token || !safeEqual(token, adminToken)) return fail(res, 401, 'Invalid owner token');
    next();
  };
  const requireAdmin = [adminFailLimit, checkAdmin];

  const api = express.Router();
  api.use(readLimit);

  api.get('/health', (req, res) => ok(res, { status: 'ok' }));

  api.get('/admin/verify', requireAdmin, (req, res) => ok(res, { owner: true }));

  api.post('/visitors', visitorGlobalLimit, visitorLimit, express.json({ limit: '4kb' }), async (req, res, next) => {
    const parsed = visitorSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'Invalid visitor record');
    try {
      ok(res, await store.upsertVisitor({ ...parsed.data, at: new Date().toISOString() }), 201);
    } catch (e) {
      next(e);
    }
  });

  api.get('/visitors', requireAdmin, async (req, res, next) => {
    try {
      ok(res, await store.listVisitors());
    } catch (e) {
      next(e);
    }
  });

  api.post('/exports', exportLimit, express.raw({ type: 'application/octet-stream', limit: MAX_EXPORT_BYTES }), async (req, res, next) => {
    const name = String(req.query.name || '');
    if (!EXPORT_NAME.test(name)) return fail(res, 400, 'Invalid export file name');
    if (!Buffer.isBuffer(req.body) || !req.body.length) return fail(res, 400, 'Empty export');
    if (!looksLikeExport(name, req.body)) return fail(res, 400, 'Export content does not match its type');
    try {
      ok(res, await store.saveExport(name, req.body), 201);
    } catch (e) {
      next(e);
    }
  });

  api.get('/exports', requireAdmin, async (req, res, next) => {
    try {
      ok(res, await store.listExports());
    } catch (e) {
      next(e);
    }
  });

  api.get('/exports/:file', requireAdmin, (req, res) => {
    const file = path.basename(req.params.file);
    const full = store.exportPath(file);
    if (file !== req.params.file || !fs.existsSync(full)) return fail(res, 404, 'Export not found');
    res.download(full, file.replace(/^[0-9TZ-]+-(?=AJ-IT-Solution-)/, ''));
  });

  api.use((req, res) => fail(res, 404, 'Not found'));
  app.use('/api', api);

  if (clientDir && fs.existsSync(path.join(clientDir, 'index.html'))) {
    app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api(\/|$)).*/,(req, res) => res.sendFile(path.join(clientDir, 'index.html')));
  }

  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return fail(res, 413, 'Payload too large');
    if (err.type === 'entity.parse.failed') return fail(res, 400, 'Malformed request body');
    logger.error('[aj-it-solution] request failed', req.method, req.path, err);
    fail(res, 500, 'Something went wrong');
  });

  return app;
}
