// Implements the small `window.claude.use(name)` runtime that the SHUBH page code asks for
// (visitor storage, owner access list, downloads) on top of this app's Express API.

const VISITOR_KEY = 'shubh-visitor-id';
const ADMIN_KEY = 'shubh-admin-token';
const LEADS_POLL_MS = 15000;

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    return null;
  }
  return value;
}

// The token arrives in the URL fragment (#admin=...), which browsers never send to the server.
function takeAdminTokenFromUrl() {
  const m = location.hash.match(/^#admin=([^&]+)$/);
  if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  return decodeURIComponent(m[1]);
}

function visitorId() {
  let id = store(VISITOR_KEY);
  if (!id) id = store(VISITOR_KEY, crypto.randomUUID());
  return id;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 * @returns {Promise<any>}
 */
async function api(path, init = {}, token = store(ADMIN_KEY)) {
  const headers = new Headers(init.headers);
  if (token) headers.set('x-admin-token', token);
  if (init.body && typeof init.body === 'string') headers.set('content-type', 'application/json');
  const res = await fetch('/api' + path, { ...init, headers });
  const body = await res.json().catch(() => ({ success: false, error: 'Bad response' }));
  if (!res.ok || !body.success) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body.data;
}

// A token from the URL only replaces the stored one once the server accepts it,
// so a crafted #admin= link cannot log the owner out.
async function checkOwner() {
  const fresh = takeAdminTokenFromUrl();
  if (fresh) {
    try {
      await api('/admin/verify', {}, fresh);
      store(ADMIN_KEY, fresh);
      return true;
    } catch {
      // fall through to the stored token
    }
  }
  if (!store(ADMIN_KEY)) return false;
  try {
    await api('/admin/verify');
    return true;
  } catch (e) {
    if (e.status === 401) store(ADMIN_KEY, null);
    return false;
  }
}

let ownerCheck = null;
const user = {
  id: async () => visitorId(),
  isOwner: () => (ownerCheck ??= checkOwner()),
  me: async () => null,
  profiles: async () => ({}),
};

const db = {
  doc(path) {
    const [collection, id] = path.split('/');
    return {
      set: async (rec) => {
        if (collection !== 'visitors') throw new Error('Unknown collection');
        await api('/visitors', { method: 'POST', body: JSON.stringify({ ...rec, id }) });
      },
    };
  },
  collection(name) {
    const query = {
      orderBy: () => query,
      onSnapshot(onNext, onError) {
        if (name !== 'visitors') throw new Error('Unknown collection');
        let stopped = false;
        const tick = async () => {
          try {
            const rows = await api('/visitors');
            if (!stopped) onNext({ docs: rows.map((r) => ({ id: r.id, data: () => r })) });
          } catch (e) {
            if (!stopped && onError) onError(e);
          }
        };
        tick();
        const timer = setInterval(tick, LEADS_POLL_MS);
        return () => { stopped = true; clearInterval(timer); };
      },
    };
    return query;
  },
};

function browserDownload(filename, data) {
  const type = filename.endsWith('.pdf') ? 'application/pdf' : filename.endsWith('.csv') ? 'text/csv;charset=utf-8' : 'text/html';
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const downloads = {
  async save({ filename, data }) {
    browserDownload(filename, data);
    // Keep a server-side copy of every export; a failed upload must not block the user's download.
    fetch('/api/exports?name=' + encodeURIComponent(filename), {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: data,
    }).catch(() => {});
  },
};

const CAPABILITIES = { user, db, downloads };

window.claude = { use: async (name) => CAPABILITIES[name] ?? null };
