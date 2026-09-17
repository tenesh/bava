/**
 * The tool rail's contents: common tools only, in groups. Every other shape
 * is reached from the insert panel (canvas-toolbar.md). Data, not markup, so
 * the layout decision is tested once and the component only draws it.
 */
import type { MessageKey } from '../i18n/messages';
import type { ToolId } from './tools.svelte';
import { TOOLS } from './tools.svelte';

export type RailItem =
  | { id: 'insert'; key: string; labelKey: MessageKey }
  | { id: ToolId; key: string; labelKey: MessageKey };

function tool(id: ToolId): RailItem {
  const found = TOOLS.find((t) => t.id === id);
  if (!found) throw new Error(`rail names a tool with no key: ${id}`);
  return { id, key: found.key.toUpperCase(), labelKey: found.labelKey };
}

export const RAIL_GROUPS: RailItem[][] = [
  [{ id: 'insert', key: '/', labelKey: 'rail.insert' }],
  (['select', 'rect', 'ellipse', 'arrow', 'line', 'pen', 'text'] as ToolId[]).map(tool),
  (['frame', 'eraser'] as ToolId[]).map(tool),
];
