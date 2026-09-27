/**
 * The editor's keys: Notion's and the Markdown editors' usual set, ⌘ on a Mac
 * and Ctrl elsewhere (ProseMirror's "Mod"). Undo and redo come from the
 * native menu through the app's edit routing, and here for the keys too.
 */
import { baseKeymap, chainCommands, setBlockType } from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import type { Command } from 'prosemirror-state';
import { splitListItem } from 'prosemirror-schema-list';
import { commands } from './commands';
import { schema } from './schema';

/** Backspace at the start of a heading makes it text again, as Notion does. */
const headingToText: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset !== 0 || $from.parent.type !== schema.nodes.heading) return false;
  return setBlockType(schema.nodes.paragraph)(state, dispatch);
};

/** Reports a key to the pane when it listens; otherwise the key is not taken. */
const report = (listener?: () => void) => () => {
  listener?.();
  return listener !== undefined;
};

export function keys(options: { onLink?: () => void; onBlockMenu?: () => void; onBubble?: () => void } = {}) {
  return [
    keymap({
      Enter: splitListItem(schema.nodes.list_item),
      Tab: commands.sink,
      'Shift-Tab': commands.lift,
      Backspace: headingToText,
      'Mod-b': commands.bold,
      'Mod-i': commands.italic,
      'Mod-u': commands.underline,
      'Mod-Shift-x': commands.strike,
      'Mod-e': commands.code,
      'Mod-k': report(options.onLink),
      'Mod-/': report(options.onBlockMenu),
      'Alt-F10': report(options.onBubble),
      'Mod-z': undo,
      'Shift-Mod-z': redo,
      'Mod-y': redo,
    }),
    keymap({ ...baseKeymap, Enter: chainCommands(baseKeymap.Enter) }),
  ];
}
