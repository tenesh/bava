// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import AccessBar from './AccessBar.svelte';

describe('AccessBar', () => {
  it('says what Bava cannot show and offers to allow the folder', () => {
    const onAllow = vi.fn();
    render(AccessBar, { folder: 'Documents', onAllow });
    const bar = document.querySelector<HTMLElement>('[role="region"]')!;
    expect(bar.getAttribute('aria-label')).toBe('Folder access');
    expect(bar.textContent).toContain("Pictures and files beside this page need access to Documents.");
    [...bar.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Allow access')!.click();
    expect(onAllow).toHaveBeenCalledOnce();
  });
});
