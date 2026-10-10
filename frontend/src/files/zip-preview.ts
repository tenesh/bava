/**
 * What a Markdown zip holds, shaped for its preview: the folders, pages and
 * other files as a tree, the hidden .bava folder's parts as counts, and the
 * totals for the dialog's foot. From Go's own list of the zip's files.
 */
import type { ZipFile } from './space.svelte';
import { formatBytes } from './space-helpers';
import { t } from '../i18n/t';

export type ZipRow = { name: string; depth: number; kind: 'folder' | 'page' | 'file' };
export type ZipPreview = {
  rows: ZipRow[];
  hidden: { attachments: number; templates: number; settings: boolean };
  pages: number;
  files: number;
  bytes: number;
};

const HIDDEN = '.bava/';

export function zipPreview(files: ZipFile[]): ZipPreview {
  const shown = files.filter((f) => !f.path.startsWith(HIDDEN)).map((f) => f.path);
  const rows: ZipRow[] = [];
  const folders = new Set<string>();
  // Folders before the files beside them, each level by name, as the tree shows.
  const sorted = [...shown].sort((a, b) => {
    const pa = a.split('/');
    const pb = b.split('/');
    for (let i = 0; i < Math.min(pa.length, pb.length); i += 1) {
      if (pa[i] === pb[i]) continue;
      const aDir = i < pa.length - 1;
      const bDir = i < pb.length - 1;
      if (aDir !== bDir) return aDir ? -1 : 1;
      return pa[i].localeCompare(pb[i]);
    }
    return pa.length - pb.length;
  });
  for (const path of sorted) {
    const parts = path.split('/');
    for (let i = 0; i < parts.length - 1; i += 1) {
      const folder = parts.slice(0, i + 1).join('/');
      if (!folders.has(folder)) {
        folders.add(folder);
        rows.push({ name: parts[i], depth: i, kind: 'folder' });
      }
    }
    const name = parts[parts.length - 1];
    const page = /\.md$/i.test(name);
    rows.push({ name: page ? name.slice(0, -3) : name, depth: parts.length - 1, kind: page ? 'page' : 'file' });
  }
  return {
    rows,
    hidden: {
      attachments: files.filter((f) => f.path.startsWith(`${HIDDEN}attachments/`)).length,
      templates: files.filter((f) => f.path.startsWith(`${HIDDEN}templates/`)).length,
      settings: files.some((f) => f.path === `${HIDDEN}space.json`),
    },
    pages: shown.filter((p) => /\.md$/i.test(p)).length,
    files: files.length,
    bytes: files.reduce((sum, f) => sum + f.size, 0),
  };
}

/** The dialog's foot: "12 pages · 9 files · 1.2 MB". */
export function zipSummary(files: ZipFile[]): string {
  const p = zipPreview(files);
  const pages = p.pages === 1 ? t('export.pagesOne') : t('export.pages').replace('{n}', String(p.pages));
  const count = p.files === 1 ? t('export.filesOne') : t('export.files').replace('{n}', String(p.files));
  return t('export.summary').replace('{pages}', pages).replace('{files}', count).replace('{size}', formatBytes(p.bytes));
}
