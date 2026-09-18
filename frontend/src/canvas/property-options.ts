/**
 * The choices each style property offers, with the icon for each.
 *
 * Data, not markup: the toolbar and the tests read the same list, and adding a
 * value means adding it here and to `docs/file-format.md`.
 */
import type { IconId } from '../components/tool-icons';
import type { MessageKey } from '../i18n/messages';
import type { PropertyKey, PropertyValue } from './style';

export type PropertyOption = { value: PropertyValue; labelKey: MessageKey; icon: IconId };

export type PropertyControl = {
  labelKey: MessageKey;
  /** The icon on the row's button. */
  icon: IconId;
  options: PropertyOption[];
};

const HEADS: PropertyOption[] = [
  { value: 'none', labelKey: 'option.none', icon: 'headNone' },
  { value: 'arrow', labelKey: 'option.arrow', icon: 'headArrow' },
  { value: 'bar', labelKey: 'option.bar', icon: 'headBar' },
  { value: 'triangle', labelKey: 'option.triangle', icon: 'headTriangle' },
  { value: 'triangle-outline', labelKey: 'option.triangle-outline', icon: 'headTriangle' },
  { value: 'circle', labelKey: 'option.circle', icon: 'headCircle' },
  { value: 'circle-outline', labelKey: 'option.circle-outline', icon: 'headCircle' },
  { value: 'diamond', labelKey: 'option.diamond', icon: 'headDiamond' },
  { value: 'diamond-outline', labelKey: 'option.diamond-outline', icon: 'headDiamond' },
];

export const PROPERTY_OPTIONS: Record<PropertyKey, PropertyControl> = {
  strokeWidth: {
    labelKey: 'style.strokeWidth',
    icon: 'strokeWidth',
    options: [
      { value: 1, labelKey: 'option.thin', icon: 'strokeWidth' },
      { value: 2, labelKey: 'option.medium', icon: 'strokeWidth' },
      { value: 4, labelKey: 'option.bold', icon: 'strokeWidth' },
    ],
  },
  strokeStyle: {
    labelKey: 'style.strokeStyle',
    icon: 'strokeStyle',
    options: [
      { value: 'solid', labelKey: 'option.solid', icon: 'strokeWidth' },
      { value: 'dashed', labelKey: 'option.dashed', icon: 'strokeStyle' },
      { value: 'dotted', labelKey: 'option.dotted', icon: 'headCircle' },
    ],
  },
  edges: {
    labelKey: 'style.edges',
    icon: 'edges',
    options: [
      { value: 'sharp', labelKey: 'option.sharp', icon: 'edgesSharp' },
      { value: 'round', labelKey: 'option.round', icon: 'edges' },
    ],
  },
  opacity: { labelKey: 'style.opacity', icon: 'opacity', options: [] },
  fontSize: {
    labelKey: 'style.fontSize',
    icon: 'fontSize',
    options: [
      { value: 16, labelKey: 'option.small', icon: 'fontSize' },
      { value: 20, labelKey: 'option.medium', icon: 'fontSize' },
      { value: 28, labelKey: 'option.large', icon: 'fontSize' },
      { value: 36, labelKey: 'option.very-large', icon: 'fontSize' },
    ],
  },
  align: {
    labelKey: 'style.align',
    icon: 'align',
    options: [
      { value: 'left', labelKey: 'option.left', icon: 'alignTextLeft' },
      { value: 'center', labelKey: 'option.centre', icon: 'alignTextCenter' },
      { value: 'right', labelKey: 'option.right', icon: 'alignTextRight' },
    ],
  },
  verticalAlign: {
    labelKey: 'style.verticalAlign',
    icon: 'verticalAlign',
    options: [
      { value: 'top', labelKey: 'option.top', icon: 'verticalTop' },
      { value: 'middle', labelKey: 'option.middle', icon: 'verticalMiddle' },
      { value: 'bottom', labelKey: 'option.bottom', icon: 'verticalBottom' },
    ],
  },
  arrowType: {
    labelKey: 'style.arrowType',
    icon: 'arrowType',
    options: [
      { value: 'straight', labelKey: 'option.straight', icon: 'arrowStraight' },
      { value: 'elbow', labelKey: 'option.elbow', icon: 'arrowElbow' },
      { value: 'arc', labelKey: 'option.arc', icon: 'arrowArc' },
    ],
  },
  startArrowhead: { labelKey: 'style.startArrowhead', icon: 'headCircle', options: HEADS },
  endArrowhead: { labelKey: 'style.endArrowhead', icon: 'headArrow', options: HEADS },
};
