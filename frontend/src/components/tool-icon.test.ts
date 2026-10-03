// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '../test/render';
import ToolIcon from './ToolIcon.svelte';
import { ICON_IDS } from './tool-icons';
import { RAIL_GROUPS } from '../canvas/rail';

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
