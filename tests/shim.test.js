// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const GOOD = 'owner-token-0123456789-abcdefghijkl';
let calls;

function mockFetch(handler) {
  calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const headers = new Headers(init.headers);
    calls.push({ url, method: init.method || 'GET', token: headers.get('x-admin-token'), body: init.body });
    const [status, body] = handler(url, headers, init);
    return { ok: status < 300, status, json: async () => body };
  });
}

const verifyOnly = (url, headers, init) => {
  if (url === '/api/admin/verify') return headers.get('x-admin-token') === GOOD ? [200, { success: true, data: { owner: true } }] : [401, { success: false, error: 'Invalid owner token' }];
  if (url === '/api/visitors' && !init.method) return headers.get('x-admin-token') !== GOOD ? [401, { success: false, error: 'Invalid owner token' }] : [200, { success: true, data: [{ id: 'v1', email: 'a@b.com', at: '2026-11-13T10:00:00Z' }] }];
  return [201, { success: true, data: {} }];
};

async function load(hash = '') {
  vi.resetModules();
  history.replaceState(null, '', '/' + hash);
  await import('../client/src/runtime/claude-shim.js');
  return window.claude;
}

beforeEach(() => {
  localStorage.clear();
  mockFetch(verifyOnly);
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.useRealTimers());

describe('window.claude.use', () => {
  test('returns null for capabilities the app does not provide', async () => {
    const claude = await load();
    expect(await claude.use('sample')).toBeNull();
    expect(await claude.use('user')).not.toBeNull();
  });
});

describe('user', () => {
  test('keeps a stable visitor id', async () => {
    const user = await (await load()).use('user');
    const id = await user.id();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await user.id()).toBe(id);
    expect(await user.me()).toBeNull();
  });

  test('is not owner without a token and makes no request', async () => {
    const user = await (await load()).use('user');
    expect(await user.isOwner()).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test('accepts a valid #admin token, stores it and clears the URL', async () => {
    const user = await (await load('#admin=' + GOOD)).use('user');
    expect(await user.isOwner()).toBe(true);
    expect(localStorage.getItem('shubh-admin-token')).toBe(GOOD);
    expect(location.hash).toBe('');
  });

  test('a bad #admin link does not replace a working stored token', async () => {
    localStorage.setItem('shubh-admin-token', GOOD);
    const user = await (await load('#admin=attacker-junk')).use('user');
    expect(await user.isOwner()).toBe(true);
    expect(localStorage.getItem('shubh-admin-token')).toBe(GOOD);
  });

  test('drops a stored token the server rejects', async () => {
    localStorage.setItem('shubh-admin-token', 'revoked-token');
    const user = await (await load()).use('user');
    expect(await user.isOwner()).toBe(false);
    expect(localStorage.getItem('shubh-admin-token')).toBeNull();
  });
});

describe('db', () => {
  test('saves the gate record as a visitor with the visitor id', async () => {
    const claude = await load();
    const db = await claude.use('db');
    await db.doc('visitors/abc').set({ email: 'a@b.com', via: 'email', at: 'x' });
    expect(calls[0]).toMatchObject({ url: '/api/visitors', method: 'POST' });
    expect(JSON.parse(calls[0].body)).toMatchObject({ id: 'abc', email: 'a@b.com', via: 'email' });
  });

  test('rejects unknown collections', async () => {
    const db = await (await load()).use('db');
    await expect(db.doc('secrets/1').set({})).rejects.toThrow('Unknown collection');
    expect(() => db.collection('secrets').orderBy().onSnapshot(() => {})).toThrow('Unknown collection');
  });

  test('streams the owner list and stops on unsubscribe', async () => {
    vi.useFakeTimers();
    localStorage.setItem('shubh-admin-token', GOOD);
    const db = await (await load()).use('db');
    const snaps = [];
    const stop = db.collection('visitors').orderBy('at', 'desc').onSnapshot((s) => snaps.push(s.docs.map((d) => d.data().email)));
    await vi.advanceTimersByTimeAsync(0);
    expect(snaps).toEqual([['a@b.com']]);
    await vi.advanceTimersByTimeAsync(15000);
    expect(snaps).toHaveLength(2);
    stop();
    await vi.advanceTimersByTimeAsync(30000);
    expect(snaps).toHaveLength(2);
  });

  test('reports list errors to the error callback', async () => {
    const db = await (await load()).use('db');
    const errors = [];
    db.collection('visitors').onSnapshot(() => {}, (e) => errors.push(e.status));
    await vi.waitFor(() => expect(errors).toEqual([401]));
  });
});

describe('downloads', () => {
  test('downloads in the browser and uploads a server copy', async () => {
    const dl = await (await load()).use('downloads');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await dl.save({ filename: 'AJ-IT-Solution-report-1.csv', data: 'a,b' });
    expect(click).toHaveBeenCalledOnce();
    expect(calls[0]).toMatchObject({ url: '/api/exports?name=AJ-IT-Solution-report-1.csv', method: 'POST', body: 'a,b' });
  });

  test('a failed upload does not break the download', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')));
    const dl = await (await load()).use('downloads');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(dl.save({ filename: 'AJ-IT-Solution-r.pdf', data: new ArrayBuffer(4) })).resolves.toBeUndefined();
  });
});
