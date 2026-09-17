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
  | 'frame';

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
