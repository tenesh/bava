// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import TemplateBar from './TemplateBar.svelte';

describe('TemplateBar', () => {
  it('names the template and its group, and reports Done', () => {
    const onDone = vi.fn();
    render(TemplateBar, { group: 'Meetings', name: 'Weekly sync', onDone });
    const bar = document.querySelector('.template-bar')!;
    expect(bar.textContent).toContain('Template');
    expect(bar.textContent).toContain('Meetings');
    expect(bar.textContent).toContain('Weekly sync');
    [...bar.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Done')!.click();
    expect(onDone).toHaveBeenCalled();
  });

  it('names a template in no group by its name alone', () => {
    render(TemplateBar, { group: '', name: 'Bug report', onDone: vi.fn() });
    expect(document.querySelector('.template-bar .where')!.textContent?.trim()).toBe('Bug report');
  });
});
