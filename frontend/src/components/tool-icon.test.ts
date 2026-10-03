// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '../test/render';
import ToolIcon from './ToolIcon.svelte';
import { ICON_IDS } from './tool-icons';
import { RAIL_GROUPS } from '../canvas/rail';
import { PROPERTY_OPTIONS } from '../canvas/property-options';

describe('ToolIcon', () => {
  it('renders one decorative svg for every icon id', () => {
    expect(ICON_IDS.length).toBeGreaterThan(20);
    for (const id of ICON_IDS) {
      const { target } = render(ToolIcon, { id });
      const svgs = target.querySelectorAll('svg');
      expect(svgs, id).toHaveLength(1);
      expect(svgs[0].getAttribute('aria-hidden'), id).toBe('true');
    }
  });

  // The rail hands its tool ids to the icon by a cast, so the compiler does
  // not catch a rail tool with no icon; the insert panel's are typed.
  it('has an icon for every tool on the rail', () => {
    for (const item of RAIL_GROUPS.flat()) expect(ICON_IDS).toContain(item.id);
  });
});

// Every head the pickers offer looks like itself: filled and outline heads,
// and None, Bar and the entity-relation heads, are told apart by the icon.
describe('the arrowhead icons', () => {
  it('give every head its own drawing', () => {
    const heads = PROPERTY_OPTIONS.endArrowhead.options;
    const drawings = heads.map((head) => {
      const { target } = render(ToolIcon, { id: head.icon });
      return target.innerHTML;
    });
    expect(new Set(heads.map((head) => head.icon)).size).toBe(heads.length);
    expect(new Set(drawings).size).toBe(heads.length);
  });

  // A picker's button names its end whatever head is chosen, so it never
  // looks like one of the heads it offers.
  it('give the start and end head pickers their own drawings, unlike any head', () => {
    const draw = (id: string) => render(ToolIcon, { id: id as never }).target.innerHTML;
    const heads = new Set(PROPERTY_OPTIONS.endArrowhead.options.map((head) => draw(head.icon)));
    const start = draw(PROPERTY_OPTIONS.startArrowhead.icon);
    const end = draw(PROPERTY_OPTIONS.endArrowhead.icon);
    expect(start).not.toBe(end);
    expect(heads.has(start)).toBe(false);
    expect(heads.has(end)).toBe(false);
  });

  it('draw a filled head filled and an outline head open', () => {
    const filled = render(ToolIcon, { id: 'headTriangle' }).target;
    const outline = render(ToolIcon, { id: 'headTriangleOutline' }).target;
    expect(filled.querySelector('path[fill="currentColor"]')).not.toBeNull();
    expect(outline.querySelector('path[fill="currentColor"]')).toBeNull();
  });
});
