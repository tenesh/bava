// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ToolIcon from './ToolIcon.svelte';
import { ICON_IDS } from './tool-icons';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ToolIcon', () => {
  it('renders one decorative svg for every icon id', () => {
    expect(ICON_IDS.length).toBeGreaterThan(20);
    for (const id of ICON_IDS) {
      const target = document.createElement('div');
      document.body.append(target);
      const app = flushSync(() => mount(ToolIcon, { target, props: { id } }));
      const svgs = target.querySelectorAll('svg');
      expect(svgs, id).toHaveLength(1);
      expect(svgs[0].getAttribute('aria-hidden'), id).toBe('true');
      unmount(app);
    }
  });

  it('includes every rail tool and the shapes of the insert panel', () => {
    for (const id of ['select', 'rect', 'ellipse', 'arrow', 'line', 'pen', 'text', 'frame', 'eraser', 'insert',
      'diamond', 'cylinder', 'hexagon', 'parallelogram', 'document', 'person', 'cloud']) {
      expect(ICON_IDS).toContain(id);
    }
  });
});
