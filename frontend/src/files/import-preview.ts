/**
 * What an import shows it will bring, in the shape an export's zip preview
 * draws: each page and file at the path it lands at under the folder chosen,
 * a Space's attachments and templates in the hidden folder, where the
 * preview counts them.
 */
import { formatBytes } from './space-helpers';
import { t } from '../i18n/t';
import type { ImportPlan, ZipFile } from './space.svelte';

const ATTACHMENTS = '.bava/attachments';

export function importPreview(plan: ImportPlan): ZipFile[] {
  const into = plan.into ? `${plan.into}/` : '';
  const shown = (to: string) => (to.startsWith(into) ? to.slice(into.length) : to);
  // Where each folder of a pick landed, so its files show beside its pages.
  const folders = new Map<string, string>();
  for (const e of plan.entries) if (e.kind === 'folder') folders.set(`${e.origin}:${e.from}`, shown(e.to));
  return plan.entries.flatMap((e): ZipFile[] => {
    if (e.kind === 'page') return [{ path: shown(e.to), size: e.size }];
    if (e.kind === 'template') return [{ path: `.bava/templates/${e.to}`, size: e.size }];
    if (e.kind !== 'file') return [];
    const dir = e.from.includes('/') ? e.from.slice(0, e.from.lastIndexOf('/')) : '';
    if (dir === ATTACHMENTS || dir.endsWith(`/${ATTACHMENTS}`)) return [{ path: `${ATTACHMENTS}/${e.to}`, size: e.size }];
    const folder = folders.get(`${e.origin}:${dir}`);
    return [{ path: folder ? `${folder}/${e.to}` : e.to, size: e.size }];
  });
}

/** The dialog's foot: "8 pages · 4 files · 2.1 MB". */
export function importSummary(plan: ImportPlan): string {
  const pages = plan.pages === 1 ? t('export.pagesOne') : t('export.pages').replace('{n}', String(plan.pages));
  const files = plan.files === 1 ? t('export.filesOne') : t('export.files').replace('{n}', String(plan.files));
  return t('export.summary').replace('{pages}', pages).replace('{files}', files).replace('{size}', formatBytes(plan.bytes));
}
