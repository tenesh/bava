/**
 * Plain data the gallery's demos show: a Space's files, its attachments and
 * Trash, recent Spaces, pictures. Shaped as the app hands them to the
 * components, so each looks as it does in the app.
 */
import type { MediaItem } from '../../../src/files/media';
import type { SpaceEntry, TreeRow } from '../../../src/files/space.svelte';

/** Where an attachment's picture loads from: the browser tests' file route. */
export function thumb(item: MediaItem): string | null {
  const name = item.kind === 'image' ? item.name : item.kind === 'video' ? item.poster : null;
  return name ? `/bava-file/?${new URLSearchParams({ path: `.bava/attachments/${name}` })}` : null;
}

const roadmap = { name: 'Roadmap', path: 'Roadmap.md' };
const architecture = { name: 'Architecture', path: 'Engineering/Architecture.md' };

/** A Space's attachments, one of each kind, two of them unused. */
export const MEDIA: MediaItem[] = [
  { name: 'logo.png', size: 18_432, modified: '2026-09-20T10:00:00Z', kind: 'image', usedBy: [roadmap, architecture], unused: false, poster: null },
  { name: 'landscape.png', size: 245_760, modified: '2026-09-18T09:30:00Z', kind: 'image', usedBy: [], unused: true, poster: null },
  { name: 'demo.mp4', size: 3_145_728, modified: '2026-09-12T16:45:00Z', kind: 'video', usedBy: [roadmap], unused: false, poster: 'demo poster.png' },
  { name: 'notes.pdf', size: 92_160, modified: '2026-09-02T08:15:00Z', kind: 'pdf', usedBy: [architecture], unused: false, poster: null },
  { name: 'budget.xlsx', size: 40_960, modified: '2026-08-28T14:00:00Z', kind: 'other', usedBy: [], unused: true, poster: null },
];

/** A Space's Files: folders by path, '' at the top. */
export const FOLDERS: Record<string, SpaceEntry[]> = {
  '': [
    { name: 'Engineering', path: 'Engineering', kind: 'folder' },
    { name: 'Research', path: 'Research', kind: 'folder' },
    { name: 'Roadmap.md', path: 'Roadmap.md', kind: 'page' },
    { name: 'Meeting notes from the quarterly planning offsite.md', path: 'Meeting notes from the quarterly planning offsite.md', kind: 'page' },
  ],
  Engineering: [
    { name: 'Architecture.md', path: 'Engineering/Architecture.md', kind: 'page' },
    { name: 'Blocks.md', path: 'Engineering/Blocks.md', kind: 'page' },
  ],
  Research: [{ name: 'Interviews.md', path: 'Research/Interviews.md', kind: 'page' }],
};

/** The rows the tree shows with Engineering open. */
export const ROWS: TreeRow[] = [
  { entry: FOLDERS[''][0], depth: 0 },
  { entry: FOLDERS.Engineering[0], depth: 1 },
  { entry: FOLDERS.Engineering[1], depth: 1 },
  { entry: FOLDERS[''][1], depth: 0 },
  { entry: FOLDERS[''][2], depth: 0 },
  { entry: FOLDERS[''][3], depth: 0 },
];

/** Recent Spaces, the first of them open. */
export const RECENTS = [
  { path: '/Users/you/Documents/Acme Product', name: 'Acme Product' },
  { path: '/Users/you/Documents/Garden plans', name: 'Garden plans' },
  { path: '/Users/you/Work/Quarterly reviews and planning for the platform team', name: 'Quarterly reviews and planning for the platform team' },
];

/** What the Trash holds: a page, a folder and an attachment. */
export const TRASH = [
  { id: 't1', path: 'Research/Q3 retro.md', kind: 'page' as const, deletedAt: '2026-09-25T10:00:00Z', size: '4 KB' },
  { id: 't2', path: 'Archive', kind: 'folder' as const, deletedAt: '2026-09-20T10:00:00Z', size: '120 KB' },
  { id: 't3', path: '.bava/attachments/old-logo.png', kind: 'attachment' as const, deletedAt: '2026-09-01T10:00:00Z', size: '18 KB' },
];

/** A small diagram, as the preview shows one. */
export const DIAGRAM_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">' +
  '<rect x="20" y="20" width="110" height="50" rx="4" fill="#f4f4f1" stroke="#8b8b83"/><text x="75" y="50" text-anchor="middle" font-size="13" fill="#2b2b28">web</text>' +
  '<rect x="190" y="20" width="110" height="50" rx="4" fill="#f4f4f1" stroke="#8b8b83"/><text x="245" y="50" text-anchor="middle" font-size="13" fill="#2b2b28">api</text>' +
  '<rect x="105" y="130" width="110" height="50" rx="4" fill="#f4f4f1" stroke="#8b8b83"/><text x="160" y="160" text-anchor="middle" font-size="13" fill="#2b2b28">db</text>' +
  '<path d="M130 45 H190" stroke="#8b8b83" fill="none"/><path d="M245 70 L190 130" stroke="#8b8b83" fill="none"/></svg>';

/**
 * A canvas, as the export preview shows one: drawn for the settings chosen,
 * with or without its background, in light or dark, as the exporter writes it.
 */
export function exportSvg(settings: { background: boolean; dark: boolean }): string {
  const ink = settings.dark ? '#e6e6e1' : '#2b2b28';
  const ground = settings.background ? `<rect width="360" height="200" fill="${settings.dark ? '#1c1d1f' : '#ffffff'}"/>` : '';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200" viewBox="0 0 360 200">' +
    ground +
    '<rect x="20" y="30" width="130" height="70" rx="8" fill="#dbe7fb" stroke="#3b6fd8" stroke-width="2"/>' +
    '<ellipse cx="270" cy="65" rx="65" ry="38" fill="#e3f3e6" stroke="#2f8f4e" stroke-width="2"/>' +
    `<path d="M150 65 H205" stroke="${ink}" stroke-width="2" fill="none"/><path d="M195 59 L205 65 L195 71" stroke="${ink}" stroke-width="2" fill="none"/>` +
    `<text x="85" y="160" font-size="16" fill="${ink}">Release plan</text></svg>`
  );
}

/** Text long enough to run out of its room. */
export const LONG = 'A name long enough to run past the room it is given and show how it is cut';
