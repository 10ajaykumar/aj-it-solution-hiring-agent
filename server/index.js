import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const adminToken = process.env.ADMIN_TOKEN || '';

if (adminToken && adminToken.length < 32) {
  console.error('[aj-it-solution] ADMIN_TOKEN must be at least 32 characters (e.g. node -e "console.log(crypto.randomBytes(24).toString(\'base64url\'))")');
  process.exit(1);
}

const trustProxy = process.env.TRUST_PROXY;
const app = createApp({
  dataDir: path.resolve(root, process.env.DATA_DIR || 'data'),
  adminToken,
  trustProxy: !trustProxy ? false : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
  clientDir: path.join(root, 'dist'),
});

app.listen(port, host, () => {
  console.error(`[aj-it-solution] API listening on http://${host}:${port}${adminToken ? '' : ' (owner access list disabled: set ADMIN_TOKEN)'}`);
});
