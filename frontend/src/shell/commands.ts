/**
 * Menu commands: one table from command id to action.
 *
 * The native menu is declared in `internal/app/menu/spec.json` and only names
 * commands; what a command does is decided here. `COMMAND_IDS` must match the
 * spec exactly, and a test reads the spec to hold it to that. `CommandHandlers`
 * is keyed by the list, so the compiler holds the wiring to it in turn.
 */
export const COMMAND_IDS = [
  'app.about',
  'app.settings',
  'file.new',
  'file.open',
  'file.openRecent',
  'file.save',
  'file.saveAs',
  'file.export',
  'insert.diagram',
  'file.settings',
  'edit.undo',
  'edit.redo',
  'edit.cut',
  'edit.copy',
  'edit.paste',
  'edit.delete',
  'edit.selectAll',
  'view.document',
  'view.both',
  'view.canvas',
  'view.files',
  'view.ai',
  'view.zoomIn',
  'view.zoomOut',
  'view.actualSize',
  'view.theme.light',
  'view.theme.dark',
  'view.theme.system',
  'tool.select',
  'tool.rect',
  'tool.ellipse',
  'tool.arrow',
  'tool.line',
  'tool.pen',
  'tool.text',
  'tool.frame',
  'tool.code',
  'tool.eraser',
  'tool.diamond',
  'tool.cylinder',
  'tool.hexagon',
  'tool.parallelogram',
  'tool.document',
  'tool.person',
  'tool.cloud',
  'canvas.group',
  'canvas.ungroup',
  'canvas.bringToFront',
  'canvas.bringForward',
  'canvas.sendBackward',
  'canvas.sendToBack',
  'canvas.flipHorizontal',
  'canvas.flipVertical',
  'canvas.duplicate',
  'canvas.alignLeft',
  'canvas.alignCenter',
  'canvas.alignRight',
  'canvas.alignTop',
  'canvas.alignMiddle',
  'canvas.alignBottom',
  'canvas.distributeHorizontal',
  'canvas.distributeVertical',
  'canvas.copyPng',
  'canvas.copySvg',
  'canvas.exportSelection',
  'canvas.copyStyles',
  'canvas.pasteStyles',
  'canvas.lock',
  'canvas.unlockAll',
  'help.shortcuts',
  'help.openLogs',
  'help.copyDiagnostics',
  'help.about',
] as const;

export type CommandId = (typeof COMMAND_IDS)[number];

/** What the Go side emits on `menu:command`. */
export type Command = { id: string; arg?: string };

/** `arg` is set only by commands that carry data: the path, for a recent file. */
export type CommandHandlers = Record<CommandId, (arg?: string) => void | Promise<void>>;

export const MENU_COMMAND_EVENT = 'menu:command';

function isCommandId(id: string): id is CommandId {
  return (COMMAND_IDS as readonly string[]).includes(id);
}

export function createDispatcher(
  handlers: CommandHandlers,
  options: { onError?: (id: CommandId, error: unknown) => void } = {},
) {
  return {
    async dispatch(command: Command): Promise<void> {
      // A newer menu talking to an older frontend is not worth crashing over.
      if (!isCommandId(command.id)) return;
      try {
        await handlers[command.id](command.arg);
      } catch (error) {
        // The event callback has nobody to reject to; a swallowed failure here
        // would be a save that silently did not happen.
        options.onError?.(command.id, error);
      }
    },
  };
}
