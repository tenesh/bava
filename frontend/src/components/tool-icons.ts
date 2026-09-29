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
import Split from '@lucide/svelte/icons/split';
import Equal from '@lucide/svelte/icons/equal';
import CircleDot from '@lucide/svelte/icons/circle-dot';
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
import Triangle from '@lucide/svelte/icons/triangle';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Square from '@lucide/svelte/icons/square';
import SquareDashed from '@lucide/svelte/icons/square-dashed';
import Trash from '@lucide/svelte/icons/trash';
import Type from '@lucide/svelte/icons/type';
import User from '@lucide/svelte/icons/user';
import X from '@lucide/svelte/icons/x';

/** The one icon Lucide lacks, as a path on its 24-unit grid. */
export const PARALLELOGRAM_PATH = 'M7 5h14l-4 14H3z';

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
  headNone: Minus,
  headArrow: MoveUpRight,
  headBar: Minus,
  headTriangle: Triangle,
  headCircle: CircleSmall,
  headDiamond: Diamond,
  headMany: Split,
  labelUpright: Type,
  labelAlong: MoveUpRight,
  headExactlyOne: Equal,
  headZero: CircleDot,
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

export type IconId = keyof typeof LUCIDE_ICONS | 'parallelogram';

export const ICON_IDS: IconId[] = [...(Object.keys(LUCIDE_ICONS) as IconId[]), 'parallelogram'];
