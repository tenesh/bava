/**
 * What the selection toolbar offers for a selection (canvas-toolbar.md).
 *
 * A mixed selection shows every control some selected element takes; the
 * pickers show a mixed value where they differ. Align needs two units,
 * distribute three. What does not fit the row moves into More, rather than the
 * row wrapping or scrolling.
 */
import { topLevel } from './edit';
import { createScene, type ElementId, type SceneData } from './scene';
import { propertyKeysFor, styleKeysOf, type PropertyKey, type StyleKey } from './style';

export type ControlGroup = 'colour' | 'stroke' | 'label' | 'arrow' | 'code';

/** How a control is drawn: a swatch chip, a set of icon options, or a slider. */
export type ControlKind = 'colour' | 'options' | 'slider';

export type ToolbarControl = {
  id: StyleKey | PropertyKey;
  group: ControlGroup;
  kind: ControlKind;
};

/**
 * What the toolbar offers a line or arrow: finish one drawn by clicks (the
 * Done button), edit its points, close a line into a loop or open it again.
 */
export type LineAction = 'finishLine' | 'editPoints' | 'closeLine' | 'openLine';

export type ToolbarModel = {
  visible: boolean;
  lineActions: LineAction[];
  /** The controls this selection takes, in the order the row shows them. */
  controls: ToolbarControl[];
  styles: StyleKey[];
  align: boolean;
  distribute: boolean;
};

const COLOURS: StyleKey[] = ['fill', 'stroke', 'color'];

/** Every control, in row order, with the group it belongs to. */
const ORDERED: ToolbarControl[] = [
  { id: 'language', group: 'code', kind: 'options' },
  { id: 'fill', group: 'colour', kind: 'colour' },
  { id: 'stroke', group: 'colour', kind: 'colour' },
  { id: 'color', group: 'colour', kind: 'colour' },
  { id: 'strokeWidth', group: 'stroke', kind: 'options' },
  { id: 'strokeStyle', group: 'stroke', kind: 'options' },
  { id: 'edges', group: 'stroke', kind: 'options' },
  { id: 'opacity', group: 'stroke', kind: 'slider' },
  { id: 'fontSize', group: 'label', kind: 'options' },
  { id: 'align', group: 'label', kind: 'options' },
  { id: 'verticalAlign', group: 'label', kind: 'options' },
  { id: 'arrowType', group: 'arrow', kind: 'options' },
  { id: 'startArrowhead', group: 'arrow', kind: 'options' },
  { id: 'endArrowhead', group: 'arrow', kind: 'options' },
];

/**
 * `drawing`: a line is being drawn by clicks, and the toolbar is its Done
 * button alone. `editing`: the id of the line or arrow in point editing.
 */
export function toolbarFor(scene: SceneData, ids: ElementId[], context: { drawing?: boolean; editing?: string | null } = {}): ToolbarModel {
  if (context.drawing) return { visible: true, lineActions: ['finishLine'], controls: [], styles: [], align: false, distribute: false };
  const selected = new Set(ids);
  const elements = scene.elements.filter((e) => selected.has(e.id));
  const takes = new Set<string>(
    elements.flatMap((e) => [...styleKeysOf(e), ...propertyKeysFor(e.type)] as string[]),
  );
  // A group selected with its children is one unit, as align treats it.
  const units = topLevel(createScene(scene), elements).length;
  return {
    visible: elements.length > 0,
    lineActions: lineActionsFor(elements, context.editing ?? null),
    controls: ORDERED.filter((control) => takes.has(control.id)),
    styles: COLOURS.filter((key) => takes.has(key)),
    align: units >= 2,
    distribute: units >= 3,
  };
}

/**
 * The controls that fit a row `capacity` controls wide, and those that move
 * into More. One slot is More's own, and at least one control is always shown:
 * a bar with nothing on it explains nothing.
 */
export function splitForWidth<T>(controls: T[], capacity: number): { shown: T[]; overflow: T[] } {
  if (controls.length <= capacity) return { shown: controls, overflow: [] };
  const room = Math.max(1, capacity - 1);
  return { shown: controls.slice(0, room), overflow: controls.slice(room) };
}

function lineActionsFor(elements: SceneData['elements'], editing: string | null): LineAction[] {
  if (elements.length !== 1) return [];
  const [element] = elements;
  if (element.type !== 'line' && element.type !== 'arrow') return [];
  const actions: LineAction[] = [];
  const elbow = (element as { arrowType?: string }).arrowType === 'elbow';
  if (!elbow && editing !== element.id) actions.push('editPoints');
  // A loop needs a corner to go round: a line of three points or more.
  const points = ('points' in element ? element.points : []) as number[];
  if (element.type === 'line') {
    if ((element as { closed?: boolean }).closed) actions.push('openLine');
    else if (points.length >= 6) actions.push('closeLine');
  }
  return actions;
}

