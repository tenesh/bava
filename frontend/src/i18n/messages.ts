/**
 * Every user-facing string in the product.
 *
 * One locale, and no plural or date formatting yet — so this is a typed map
 * rather than a library, which would be weight without a use. What matters is
 * the rule it enforces: no user-facing string is written inline in a
 * component, so adding a locale later is a data problem rather than a hunt.
 */
export const messages = {
  'pane.source': 'D2 source',
  'pane.canvas': 'Diagram',
  'pane.files': 'Files',
  'pane.document': 'Document',
  'pane.ai': 'AI',

  'view.document': 'Document',
  'view.both': 'Both',
  'view.canvas': 'Canvas',
  'view.switcher': 'View mode',

  'empty.files.title': 'No workspace open',
  'empty.files.body': 'Open a folder to see its files here.',
  'empty.canvas.title': 'Nothing on the canvas',
  'empty.canvas.body': 'Drawing tools arrive in a later milestone.',

  'status.engine': 'Engine',
  'status.nodes': 'Nodes',
  'status.errors': 'Errors',

  'tool.select': 'Select',
  'tool.rect': 'Rectangle',
  'tool.ellipse': 'Ellipse',
  'tool.arrow': 'Arrow',
  'tool.line': 'Line',
  'tool.pen': 'Draw',
  'tool.text': 'Text',
  'tool.frame': 'Frame',
  'canvas.tools': 'Tools',
  'canvas.zoomIn': 'Zoom in',
  'canvas.zoomOut': 'Zoom out',

  'file.untitled': 'untitled',
  'file.dirty': 'unsaved',
  'file.saved': 'saved',
  'file.conflict.title': 'This file changed on disk',
  'file.conflict.body': 'Another program wrote to this file since you opened it.',
  'file.conflict.reload': 'Reload from disk',
  'file.conflict.overwrite': 'Keep mine',
  'file.error.title': 'Could not open that file',

  'file.openFolder': 'Open folder',
  'file.noFolder': 'No folder open',
  'file.noFolderBody': 'Open a folder to see its files here.',
  'file.unsaved.title': 'Unsaved changes',
  'file.unsaved.body': 'Save your changes before continuing?',
  'file.unsaved.save': 'Save',
  'file.unsaved.discard': 'Discard',
  'file.cancel': 'Cancel',

  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.system': 'Follow system',
  'settings.files': 'Files',
  'settings.autosave': 'Autosave',
  'settings.autosave.off': 'Off',
  'settings.autosave.afterDelay': 'After a delay',
  'settings.autosave.onFocusChange': 'When focus leaves',
  'settings.autosaveDelay': 'Delay (ms)',

  'status.autosavePaused': 'Autosave paused: file changed on disk. Save to decide.',
  'status.autosaveFailed': 'Autosave paused: the last save failed. Save to retry.',
  'error.command': 'That did not work',
  'error.settingsLoad': 'Settings could not be read; changes will not be saved.',
  'error.settingsSave': 'That setting could not be saved.',

  'about.title': 'Bava',
  'about.body': 'Local-only diagrams and docs. Free and open source under Apache-2.0.',
  'about.close': 'Close',
  'shortcuts.title': 'Keyboard shortcuts',
} as const;

export type MessageKey = keyof typeof messages;
