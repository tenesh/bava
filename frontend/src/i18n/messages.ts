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

  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.system': 'Follow system',
} as const;

export type MessageKey = keyof typeof messages;
