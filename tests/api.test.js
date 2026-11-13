import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../server/app.js';

const TOKEN = 'owner-token-0123456789';
const visitor = (over = {}) => ({ id: crypto.randomUUID(), email: 'asha@company.com', via: 'email', at: new Date().toISOString(), ...over });

let dataDir;
let app;
const silent = { error: () => {} };

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shubh-'));
  app = createApp({ dataDir, adminToken: TOKEN, logger: silent });
});
afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

describe('health', () => {
  test('returns ok envelope', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  test('unknown api route returns 404 envelope', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('visitors', () => {
  test('stores a typed-email visitor from the gate with a server timestamp', async () => {
    const v = visitor({ at: '2099-01-01T00:00:00.000Z' });
    const before = Date.now();
    const res = await request(app).post('/api/visitors').send(v);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: v.id, email: v.email, via: 'email' });
    expect(Date.parse(res.body.data.at)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(res.body.data.at)).toBeLessThanOrEqual(Date.now());
  });

  test('upserts the same visitor and keeps the first visit time', async () => {
    const v = visitor();
    const first = await request(app).post('/api/visitors').send(v);
    await new Promise((r) => setTimeout(r, 5));
    const res = await request(app).post('/api/visitors').send({ ...v, email: 'new@company.com' });
    expect(res.body.data).toMatchObject({ email: 'new@company.com', firstAt: first.body.data.at });
    const list = await request(app).get('/api/visitors').set('x-admin-token', TOKEN);
    expect(list.body.data).toHaveLength(1);
  });

  test.each([
    ['bad email', { email: 'not-an-email' }],
    ['bad id', { id: '../../etc' }],
    ['bad via', { via: 'hack' }],
  ])('rejects %s', async (_, over) => {
    const res = await request(app).post('/api/visitors').send(visitor(over));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Invalid visitor record' });
  });

  test('rejects malformed JSON without leaking details', async () => {
    const res = await request(app).post('/api/visitors').set('content-type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Malformed request body');
  });

  test('listing requires the owner token', async () => {
    await request(app).post('/api/visitors').send(visitor());
    expect((await request(app).get('/api/visitors')).status).toBe(401);
    expect((await request(app).get('/api/visitors').set('x-admin-token', 'wrong-token-000000')).status).toBe(401);
    const ok = await request(app).get('/api/visitors').set('x-admin-token', TOKEN);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toHaveLength(1);
  });

  test('lists newest first', async () => {
    await request(app).post('/api/visitors').send(visitor({ email: 'old@a.com' }));
    await new Promise((r) => setTimeout(r, 5));
    await request(app).post('/api/visitors').send(visitor({ email: 'new@a.com' }));
    const res = await request(app).get('/api/visitors').set('x-admin-token', TOKEN);
    expect(res.body.data.map((v) => v.email)).toEqual(['new@a.com', 'old@a.com']);
  });
});

describe('owner access', () => {
  test('verify accepts the right token only', async () => {
    expect((await request(app).get('/api/admin/verify').set('x-admin-token', TOKEN)).body.data).toEqual({ owner: true });
    expect((await request(app).get('/api/admin/verify')).status).toBe(401);
  });

  test('locks out repeated wrong tokens', async () => {
    for (let i = 0; i < 10; i++) await request(app).get('/api/admin/verify').set('x-admin-token', 'guess-' + i);
    const res = await request(app).get('/api/admin/verify').set('x-admin-token', TOKEN);
    expect(res.status).toBe(429);
  });

  test('owner routes are disabled when no token is configured', async () => {
    const open = createApp({ dataDir, logger: silent });
    expect((await request(open).get('/api/visitors').set('x-admin-token', '')).status).toBe(404);
  });
});

describe('exports', () => {
  const name = 'AJ-IT-Solution-pipeline-export-20261113-0930.csv';

  test('saves an export and lets the owner download it', async () => {
    const res = await request(app).post(`/api/exports?name=${name}`).set('content-type', 'application/octet-stream').send(Buffer.from('a,b\n1,2'));
    expect(res.status).toBe(201);
    expect(res.body.data.bytes).toBe(7);
    const list = await request(app).get('/api/exports').set('x-admin-token', TOKEN);
    expect(list.body.data).toHaveLength(1);
    const file = await request(app).get(`/api/exports/${list.body.data[0].file}`).set('x-admin-token', TOKEN);
    expect(file.status).toBe(200);
    expect(file.headers['content-disposition']).toContain(name);
  });

  test.each(['../evil.csv', 'AJ-IT-Solution-x.exe', 'notes.csv', 'AJ-IT-Solution-UPPER.csv'])('rejects file name %s', async (bad) => {
    const res = await request(app).post(`/api/exports?name=${encodeURIComponent(bad)}`).set('content-type', 'application/octet-stream').send(Buffer.from('x'));
    expect(res.status).toBe(400);
  });

  const upload = (n, body) => request(app).post(`/api/exports?name=${n}`).set('content-type', 'application/octet-stream').send(body);

  test('rejects empty and oversized bodies', async () => {
    expect((await upload(name, Buffer.alloc(0))).status).toBe(400);
    expect((await upload(name, Buffer.alloc(4 * 1024 * 1024, 97))).status).toBe(413);
  });

  test('rejects content that does not match the file type', async () => {
    expect((await upload('AJ-IT-Solution-report-1.pdf', Buffer.from('<html>phish</html>'))).status).toBe(400);
    expect((await upload('AJ-IT-Solution-report-1.csv', Buffer.from([0x4d, 0x5a, 0x00, 0x90]))).status).toBe(400);
    expect((await upload('AJ-IT-Solution-report-1.pdf', Buffer.from('%PDF-1.3 ...'))).status).toBe(201);
  });

  test('rate limits uploads per client', async () => {
    const codes = [];
    for (let i = 0; i < 7; i++) codes.push((await upload(name, Buffer.from('x'))).status);
    expect(codes.slice(0, 6).every((c) => c === 201)).toBe(true);
    expect(codes[6]).toBe(429);
  });

  test('download blocks path traversal', async () => {
    const res = await request(app).get('/api/exports/..%2Fvisitors.json').set('x-admin-token', TOKEN);
    expect(res.status).toBe(404);
  });
});

describe('export storage cap', () => {
  test('prunes the oldest files beyond 500', async () => {
    const { createStore } = await import('../server/store.js');
    const store = createStore(dataDir);
    for (let i = 0; i < 503; i++) await store.saveExport(`AJ-IT-Solution-r${i}.csv`, Buffer.from('a'));
    const files = fs.readdirSync(path.join(dataDir, 'exports'));
    expect(files).toHaveLength(500);
    expect(files.some((f) => f.endsWith('-AJ-IT-Solution-r502.csv'))).toBe(true);
    expect(files.some((f) => f.endsWith('-AJ-IT-Solution-r0.csv'))).toBe(false);
  });
});

describe('spa routing', () => {
  test('/api without a slash is not served the SPA', async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'shubh-dist-'));
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>app</title>');
    const withClient = createApp({ dataDir, adminToken: TOKEN, clientDir: dist, logger: silent });
    expect((await request(withClient).get('/pipeline')).text).toContain('<title>app</title>');
    const res = await request(withClient).get('/api');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    fs.rmSync(dist, { recursive: true, force: true });
  });
});

describe('security headers', () => {
  test('sends a CSP and hides the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
