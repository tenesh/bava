/**
 * The active tool.
 *
 * Shared state, so it lives in a runes module the rail can read. The canvas
 * consumes it imperatively: the rail emits a choice and never reaches into
 * the stage.
 */
import type { MessageKey } from '../i18n/messages';

export type ToolId =
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'pen'
  | 'text'
  | 'frame'
  | 'code'
  | 'eraser'
  | ShapeToolId;

/** The shapes added in Milestone 6, chosen from the rail's shape menu. */
export type ShapeToolId = 'diamond' | 'cylinder' | 'hexagon' | 'parallelogram' | 'document' | 'person' | 'cloud';

export type Tool = {
  id: ToolId;
  /** Single-key shortcut, as the design's rail shows. */
  key: string;
  labelKey: MessageKey;
};

export const TOOLS: Tool[] = [
  { id: 'select', key: 'v', labelKey: 'tool.select' },
  { id: 'rect', key: 'r', labelKey: 'tool.rect' },
  { id: 'ellipse', key: 'o', labelKey: 'tool.ellipse' },
  { id: 'arrow', key: 'a', labelKey: 'tool.arrow' },
  { id: 'line', key: 'l', labelKey: 'tool.line' },
  { id: 'pen', key: 'd', labelKey: 'tool.pen' },
  { id: 'text', key: 't', labelKey: 'tool.text' },
  { id: 'frame', key: 'f', labelKey: 'tool.frame' },
  { id: 'code', key: 'c', labelKey: 'tool.code' },
  { id: 'eraser', key: 'e', labelKey: 'tool.eraser' },
];

/**
 * The seven shapes without a single-key shortcut: the letters stay free, and a
 * key meaning "cloud" would be unguessable. They are reached from the rail's
 * shape menu and Canvas ▸ Tools.
 */
export const SHAPE_TOOLS: { id: ShapeToolId; labelKey: MessageKey }[] = [
  { id: 'diamond', labelKey: 'tool.diamond' },
  { id: 'cylinder', labelKey: 'tool.cylinder' },
  { id: 'hexagon', labelKey: 'tool.hexagon' },
  { id: 'parallelogram', labelKey: 'tool.parallelogram' },
  { id: 'document', labelKey: 'tool.document' },
  { id: 'person', labelKey: 'tool.person' },
  { id: 'cloud', labelKey: 'tool.cloud' },
];

export function toolForKey(key: string): ToolId | undefined {
  return TOOLS.find((tool) => tool.key === key.toLowerCase())?.id;
}

export function createTools() {
  let active = $state.raw<ToolId>('select');

  return {
    get active(): ToolId {
      return active;
    },

    activate(id: ToolId): void {
      active = id;
    },

    /** The way out of any tool. */
    escape(): void {
      active = 'select';
    },
  };
}
