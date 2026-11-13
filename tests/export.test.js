import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import { beforeAll, describe, expect, test, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.matchMedia = () => ({ matches: false });
});

import { asc, makeCSV, makeHTML, makePDF, slugF, stampF } from '../client/src/lib/export.js';

const rep = {
  title: 'Pipeline export · REQ-1042',
  sub: '3 candidates · ₹28 LPA → ₹30 LPA',
  kpis: [['Sourced', '9'], ['Screened', '6']],
  text: ['Line one\nLine two'],
  steps: [['Sourcer', 'naukri.search', '188 profiles']],
  tables: [{ title: 'Candidates', cols: ['Name', 'Note'], rows: [['Asha Rao', 'says "hi", ok'], ['<b>x</b>', 'a\nb']] }],
};

describe('asc', () => {
  test('maps symbols to PDF-safe ASCII', () => {
    expect(asc('₹28 · 5 → 6 ✓ “q”')).toBe('Rs 28 - 5 -> 6 OK "q"');
  });
});

describe('makeCSV', () => {
  test('starts with a BOM, quotes special cells and includes every section', () => {
    const csv = makeCSV(rep);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"says ""hi"", ok"');
    expect(csv).toContain('"a\nb"');
    expect(csv).toContain('Agent,Tool,Result');
    expect(csv).toContain('Line two');
  });
});

describe('makeHTML', () => {
  test('escapes report content', () => {
    const html = makeHTML(rep);
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
  });
});

describe('file names', () => {
  test('slug and stamp match the server export pattern', () => {
    const name = slugF(rep.title) + '-' + stampF() + '.pdf';
    expect(name).toMatch(/^AJ-IT-Solution-[a-z0-9-]{1,80}\.(pdf|csv|html)$/);
  });
});

describe('makePDF with the bundled jsPDF', () => {
  beforeAll(() => {
    applyPlugin(jsPDF);
    globalThis.window = { jspdf: { jsPDF } };
  });

  test('renders a multi-page A4 PDF', () => {
    const big = { ...rep, tables: [{ title: 'Rows', cols: ['A', 'B'], rows: Array.from({ length: 120 }, (_, i) => [String(i), 'row ' + i]) }] };
    const buf = makePDF(big);
    const head = new TextDecoder().decode(new Uint8Array(buf).slice(0, 5));
    expect(head).toBe('%PDF-');
    expect(buf.byteLength).toBeGreaterThan(5000);
  });
});
