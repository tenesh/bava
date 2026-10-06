/**
 * The component sheets: each family of components on one page, every state
 * side by side, pictured once per theme. A component is on exactly one sheet,
 * or pictured in a screen of the app instead (`IN_SCREENS`).
 */
export const SHEETS = {
  controls: ['Segments', 'Toggle', 'ViewSwitcher', 'SectionTabs', 'LayoutEnginePicker', 'Splitter', 'Pane', 'Icon', 'ToolIcon', 'Mark'],
  pickers: ['OptionPicker', 'OpacityPicker', 'StyleBar', 'DatePicker', 'EmojiPicker', 'FramePicker', 'TagFilter'],
  menus: ['ContextMenu', 'SlashMenu', 'SpaceSwitcher', 'Tooltip'],
  fields: ['LinkField', 'EquationField', 'FindBar'],
  'canvas-chrome': ['ToolRail', 'SelectionToolbar', 'CanvasControls', 'InsertPanel'],
  'side-pane': ['SpaceTree', 'MediaSection', 'MediaThumb', 'PageHeader', 'StatusBar', 'BlockHandle'],
  'document-floating': ['FormatBubble', 'LinkCard'],
  feedback: ['PanelBoundary', 'EmptyState', 'Progress'],
} as const satisfies Record<string, readonly string[]>;

export type Sheet = keyof typeof SHEETS;

/**
 * Components a sheet cannot hold, pictured where the app shows them: a modal
 * dialog or a whole screen, one at a time. The value is the area that does.
 */
export const IN_SCREENS: Record<string, string> = {
  AboutDialog: 'dialogs',
  ConfirmDialog: 'dialogs',
  DiagramDialog: 'dialogs',
  Dialog: 'dialogs',
  ErrorDialog: 'dialogs',
  ExportDialog: 'dialogs',
  MediaDialog: 'dialogs',
  MediaViewer: 'document',
  PageTags: 'document',
  TagChip: 'document',
  NewSpaceDialog: 'dialogs',
  ShortcutsDialog: 'dialogs',
  SpaceSettingsDialog: 'dialogs',
  TrashDialog: 'dialogs',
  TagsDialog: 'dialogs',
  SaveTemplateDialog: 'dialogs',
  TemplatesDialog: 'dialogs',
  TemplateBar: 'document',
  StartScreen: 'start',
  Splash: 'shell',
};
