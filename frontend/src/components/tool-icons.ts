/**
 * The interface's icons, by id: tools, shapes, menus and the selection
 * toolbar. Lucide (ISC) for all but the parallelogram, which Lucide lacks and
 * which is drawn here in Lucide's stroke style.
 *
 * Imported one file at a time, so only these icons reach the bundle.
 */
import type { Component } from 'svelte';
import FileImage from '@lucide/svelte/icons/file-image';
import FilePlay from '@lucide/svelte/icons/file-play';
import FileText from '@lucide/svelte/icons/file-text';
import LayoutGrid from '@lucide/svelte/icons/layout-grid';
import ListIcon from '@lucide/svelte/icons/list';
import Upload from '@lucide/svelte/icons/upload';
import Maximize2 from '@lucide/svelte/icons/maximize-2';
import Bold from '@lucide/svelte/icons/bold';
import Italic from '@lucide/svelte/icons/italic';
import Underline from '@lucide/svelte/icons/underline';
import Strikethrough from '@lucide/svelte/icons/strikethrough';
import InlineCode from '@lucide/svelte/icons/code';
import Link from '@lucide/svelte/icons/link';
import Highlighter from '@lucide/svelte/icons/highlighter';
import GripVertical from '@lucide/svelte/icons/grip-vertical';
import ChevronUp from '@lucide/svelte/icons/chevron-up';
import Replace from '@lucide/svelte/icons/replace';
import TypeIcon from '@lucide/svelte/icons/type';
import ALargeSmall from '@lucide/svelte/icons/a-large-small';
import Code from '@lucide/svelte/icons/code-2';
import AlignCenterHorizontal from '@lucide/svelte/icons/align-center-horizontal';
import AlignCenterVertical from '@lucide/svelte/icons/align-center-vertical';
import AlignEndHorizontal from '@lucide/svelte/icons/align-end-horizontal';
import AlignEndVertical from '@lucide/svelte/icons/align-end-vertical';
import AlignHorizontalDistributeCenter from '@lucide/svelte/icons/align-horizontal-distribute-center';
import AlignStartHorizontal from '@lucide/svelte/icons/align-start-horizontal';
import AlignStartVertical from '@lucide/svelte/icons/align-start-vertical';
import AlignVerticalDistributeCenter from '@lucide/svelte/icons/align-vertical-distribute-center';
import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
import Baseline from '@lucide/svelte/icons/baseline';
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import FilePlus from '@lucide/svelte/icons/file-plus';
import Folder from '@lucide/svelte/icons/folder';
import FolderOpen from '@lucide/svelte/icons/folder-open';
import FolderPlus from '@lucide/svelte/icons/folder-plus';
import Settings from '@lucide/svelte/icons/settings';
import CircleDashed from '@lucide/svelte/icons/circle-dashed';
import CircleSmall from '@lucide/svelte/icons/circle-small';
import CornerDownRight from '@lucide/svelte/icons/corner-down-right';
import Contrast from '@lucide/svelte/icons/contrast';
import Circle from '@lucide/svelte/icons/circle';
import Cloud from '@lucide/svelte/icons/cloud';
import Copy from '@lucide/svelte/icons/copy';
import Check from '@lucide/svelte/icons/check';
import Lock from '@lucide/svelte/icons/lock';
import LockOpen from '@lucide/svelte/icons/lock-open';
import PencilLine from '@lucide/svelte/icons/pencil-line';
import Pentagon from '@lucide/svelte/icons/pentagon';
import Waypoints from '@lucide/svelte/icons/waypoints';
import CopyPlus from '@lucide/svelte/icons/copy-plus';
import Cylinder from '@lucide/svelte/icons/cylinder';
import Diamond from '@lucide/svelte/icons/diamond';
import Ellipsis from '@lucide/svelte/icons/ellipsis';
import Eraser from '@lucide/svelte/icons/eraser';
import File from '@lucide/svelte/icons/file';
import Hash from '@lucide/svelte/icons/hash';
import Tag from '@lucide/svelte/icons/tag';
import Hexagon from '@lucide/svelte/icons/hexagon';
import Layers from '@lucide/svelte/icons/layers';
import Minus from '@lucide/svelte/icons/minus';
import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
import MoveUpRight from '@lucide/svelte/icons/move-up-right';
import Pencil from '@lucide/svelte/icons/pencil';
import Plus from '@lucide/svelte/icons/plus';
import Search from '@lucide/svelte/icons/search';
import Shapes from '@lucide/svelte/icons/shapes';
import Spline from '@lucide/svelte/icons/spline';
import SquareRoundCorner from '@lucide/svelte/icons/square-round-corner';
import TextAlignCenter from '@lucide/svelte/icons/text-align-center';
import TextAlignEnd from '@lucide/svelte/icons/text-align-end';
import TextAlignStart from '@lucide/svelte/icons/text-align-start';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Square from '@lucide/svelte/icons/square';
import SquareDashed from '@lucide/svelte/icons/square-dashed';
import Trash from '@lucide/svelte/icons/trash';
import Type from '@lucide/svelte/icons/type';
import User from '@lucide/svelte/icons/user';
import X from '@lucide/svelte/icons/x';

/** The one shape Lucide lacks, as a path on its 24-unit grid. */
export const PARALLELOGRAM_PATH = 'M7 5h14l-4 14H3z';

/**
 * Icons drawn here in Lucide's stroke style, on its 24-unit grid: `stroke` is
 * drawn as a line, `fill` filled. The arrowheads are a short line ending in
 * the head, as the canvas draws it, so filled and outline heads and the
 * entity-relation heads are told apart.
 */
export const DRAWN_ICONS: Record<string, { stroke: string; fill?: string }> = {
  parallelogram: { stroke: PARALLELOGRAM_PATH },
  headNone: { stroke: 'M3 12h18' },
  headArrow: { stroke: 'M3 12h17M14 6l6 6-6 6' },
  headBar: { stroke: 'M3 12h17M20 6v12' },
  headTriangle: { stroke: 'M3 12h9', fill: 'M12 6.5l9 5.5-9 5.5z' },
  headTriangleOutline: { stroke: 'M3 12h9M12 6.5l9 5.5-9 5.5z' },
  headCircle: { stroke: 'M3 12h11', fill: 'M14 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0' },
  headCircleOutline: { stroke: 'M3 12h11M14 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0' },
  headDiamond: { stroke: 'M3 12h9', fill: 'M12 12l4.5-4.5 4.5 4.5-4.5 4.5z' },
  headDiamondOutline: { stroke: 'M3 12h9M12 12l4.5-4.5 4.5 4.5-4.5 4.5z' },
  headOne: { stroke: 'M3 12h18M16 6v12' },
  headMany: { stroke: 'M3 12h18M15 12l6-6M15 12l6 6' },
  headOneOrMany: { stroke: 'M3 12h18M15 12l6-6M15 12l6 6M12 6v12' },
  headExactlyOne: { stroke: 'M3 12h18M13 6v12M17 6v12' },
  headZeroOrOne: { stroke: 'M3 12h6M15 12h6M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M19 6v12' },
  headZeroOrMany: { stroke: 'M3 12h4M13 12h8M7 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M15 12l6-6M15 12l6 6' },
  // The start and end head pickers: a line from a dot, its tail, to a head
  // at the end each picks, so neither reads as a head on offer.
  headStart: { stroke: 'M4 12h14M10 6l-6 6 6 6', fill: 'M18 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0' },
  headEnd: { stroke: 'M6 12h14M14 6l6 6-6 6', fill: 'M2 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0' },
};

export const LUCIDE_ICONS = {
  select: MousePointer2,
  rect: Square,
  ellipse: Circle,
  arrow: MoveUpRight,
  line: Minus,
  pen: Pencil,
  text: Type,
  frame: SquareDashed,
  eraser: Eraser,
  insert: Plus,
  close: X,
  search: Search,
  chevron: ChevronRight,
  more: Ellipsis,
  ai: Sparkles,
  shapes: Shapes,
  // Insert ▸ Diagram from code.
  code: Code,
  diamond: Diamond,
  cylinder: Cylinder,
  hexagon: Hexagon,
  document: File,
  person: User,
  cloud: Cloud,
  arrange: Layers,
  duplicate: CopyPlus,
  copy: Copy,
  delete: Trash,
  flipHorizontal: ArrowLeftRight,
  flipVertical: ArrowUpDown,
  alignLeft: AlignStartVertical,
  alignCenter: AlignCenterVertical,
  alignRight: AlignEndVertical,
  alignTop: AlignStartHorizontal,
  alignMiddle: AlignCenterHorizontal,
  alignBottom: AlignEndHorizontal,
  distributeHorizontal: AlignHorizontalDistributeCenter,
  distributeVertical: AlignVerticalDistributeCenter,
  // The property controls.
  strokeWidth: Minus,
  strokeStyle: CircleDashed,
  edges: SquareRoundCorner,
  edgesSharp: Square,
  opacity: Contrast,
  fontSize: ALargeSmall,
  align: TextAlignStart,
  alignTextLeft: TextAlignStart,
  alignTextCenter: TextAlignCenter,
  alignTextRight: TextAlignEnd,
  verticalAlign: Baseline,
  verticalTop: AlignStartHorizontal,
  verticalMiddle: AlignCenterHorizontal,
  verticalBottom: AlignEndHorizontal,
  arrowType: CornerDownRight,
  arrowStraight: MoveUpRight,
  arrowElbow: CornerDownRight,
  arrowArc: Spline,
  dotted: CircleSmall,
  labelUpright: Type,
  labelAlong: MoveUpRight,
  // The line actions and the tool lock.
  finishLine: Check,
  editPoints: PencilLine,
  closeLine: Pentagon,
  openLine: Waypoints,
  lock: Lock,
  lockOpen: LockOpen,
  // Spaces and the Files tree.
  page: File,
  folder: Folder,
  folderOpen: FolderOpen,
  newPage: FilePlus,
  newFolder: FolderPlus,
  chevronDown: ChevronDown,
  settings: Settings,
  // Settings' sections.
  appearance: Contrast,
  grid: Hash,
  tag: Tag,
  // The Document: the formatting bubble, the block handle, find.
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strike: Strikethrough,
  inlineCode: InlineCode,
  link: Link,
  textColor: Baseline,
  highlight: Highlighter,
  turnInto: TypeIcon,
  grip: GripVertical,
  chevronUp: ChevronUp,
  replace: Replace,
  // Media: a file by its kind, the grid and list views, adding, the dialog.
  fileImage: FileImage,
  fileVideo: FilePlay,
  fileText: FileText,
  viewGrid: LayoutGrid,
  viewList: ListIcon,
  upload: Upload,
  expand: Maximize2,
} satisfies Record<string, Component>;

export type IconId =
  | keyof typeof LUCIDE_ICONS
  | 'parallelogram'
  | 'headNone'
  | 'headArrow'
  | 'headBar'
  | 'headTriangle'
  | 'headTriangleOutline'
  | 'headCircle'
  | 'headCircleOutline'
  | 'headDiamond'
  | 'headDiamondOutline'
  | 'headOne'
  | 'headMany'
  | 'headOneOrMany'
  | 'headExactlyOne'
  | 'headZeroOrOne'
  | 'headZeroOrMany'
  | 'headStart'
  | 'headEnd';

export const ICON_IDS: IconId[] = [...(Object.keys(LUCIDE_ICONS) as IconId[]), ...(Object.keys(DRAWN_ICONS) as IconId[])];
