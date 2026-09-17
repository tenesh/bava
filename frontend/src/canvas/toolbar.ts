/**
 * What the selection toolbar offers for a selection (canvas-toolbar.md).
 *
 * A mixed selection shows every control some selected element takes; the
 * pickers show a mixed value where they differ. Align needs two units,
 * distribute three. Properties the file format does not have yet (width,
 * style, edges, opacity) join in Milestone 6.3.
 */
import { topLevel } from './edit';
import { createScene, type ElementId, type SceneData } from './scene';
import { styleKeysFor, type StyleKey } from './style';

export type ToolbarModel = {
  visible: boolean;
  styles: StyleKey[];
  align: boolean;
  distribute: boolean;
};

const ORDER: StyleKey[] = ['fill', 'stroke', 'color'];

export function toolbarFor(scene: SceneData, ids: ElementId[]): ToolbarModel {
  const selected = new Set(ids);
  const elements = scene.elements.filter((e) => selected.has(e.id));
  const taken = new Set(elements.flatMap((e) => styleKeysFor(e.type)));
  // A group selected with its children is one unit, as align treats it.
  const units = topLevel(createScene(scene), elements).length;
  return {
    visible: elements.length > 0,
    styles: ORDER.filter((key) => taken.has(key)),
    align: units >= 2,
    distribute: units >= 3,
  };
}
