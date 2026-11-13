import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_VISITORS = 10000;
const MAX_EXPORT_FILES = 500;
const MAX_EXPORT_TOTAL_BYTES = 200 * 1024 * 1024;
const LIST_LIMIT = 200;

/**
 * File-backed repository for visitors and exported reports.
 * @param {string} dataDir
 */
export function createStore(dataDir) {
  const visitorsFile = path.join(dataDir, 'visitors.json');
  const exportsDir = path.join(dataDir, 'exports');
  let queue = Promise.resolve();
  let seq = 0;

  async function readVisitors() {
    try {
      return JSON.parse(await fs.readFile(visitorsFile, 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }

  async function writeVisitors(list) {
    await fs.mkdir(dataDir, { recursive: true });
    const tmp = visitorsFile + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(list));
    await fs.rename(tmp, visitorsFile);
  }

  async function statExports() {
    try {
      const files = await fs.readdir(exportsDir);
      return Promise.all(files.map(async (file) => ({ file, bytes: (await fs.stat(path.join(exportsDir, file))).size })));
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }

  // Serialise read-modify-write cycles so concurrent requests cannot drop updates.
  const exclusive = (fn) => {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
  };

  return {
    /** @param {{id:string,email?:string,via:string,at:string}} visitor */
    upsertVisitor: (visitor) => exclusive(async () => {
      const list = await readVisitors();
      const prev = list.find((v) => v.id === visitor.id);
      const next = prev
        ? list.map((v) => (v.id === visitor.id ? { ...v, ...visitor, firstAt: v.firstAt ?? v.at } : v))
        : [...list, { ...visitor, firstAt: visitor.at }].slice(-MAX_VISITORS);
      await writeVisitors(next);
      return next.find((v) => v.id === visitor.id);
    }),

    listVisitors: async () => (await readVisitors()).toSorted((a, b) => b.at.localeCompare(a.at)),

    /** Saves an export, pruning the oldest files so storage stays within fixed caps. @param {string} name @param {Buffer} data */
    saveExport: (name, data) => exclusive(async () => {
      await fs.mkdir(exportsDir, { recursive: true });
      // Sequence keeps names unique and sortable by age when several land in the same millisecond.
      seq = (seq + 1) % 1e6;
      const file = `${new Date().toISOString().replace(/[:.]/g, '-')}-${String(seq).padStart(6, '0')}-${name}`;
      await fs.writeFile(path.join(exportsDir, file), data);
      const all = (await statExports()).toSorted((a, b) => a.file.localeCompare(b.file));
      let total = all.reduce((s, f) => s + f.bytes, 0);
      let count = all.length;
      for (const old of all) {
        if (count <= MAX_EXPORT_FILES && total <= MAX_EXPORT_TOTAL_BYTES) break;
        if (old.file === file) continue;
        await fs.rm(path.join(exportsDir, old.file), { force: true });
        total -= old.bytes;
        count -= 1;
      }
      return { file, bytes: data.length };
    }),

    listExports: async () => (await statExports()).toSorted((a, b) => b.file.localeCompare(a.file)).slice(0, LIST_LIMIT),

    exportPath: (file) => path.join(exportsDir, file),
  };
}
