// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import Toggle from './Toggle.svelte';

function setup(props: Record<string, unknown> = {}) {
  const onChange = vi.fn();
  const { target, app } = render(Toggle, { label: 'Background', checked: false, onChange, ...props } as never);
  const input = target.querySelector('input')!;
  return { app, target, input, onChange };
}

describe('Toggle', () => {
  it('is a labelled checkbox reporting what it was switched to', () => {
    const { target, input, onChange } = setup();
    expect(target.textContent).toContain('Background');
    expect(input.checked).toBe(false);
    flushSync(() => input.click());
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows the state it is given', () => {
    const { input } = setup({ checked: true });
    expect(input.checked).toBe(true);
  });

  // A disabled toggle explains itself by staying visible rather than vanishing:
  // Only selected is disabled when nothing is selected.
  it('can be disabled, and then reports nothing', () => {
    const { input, onChange } = setup({ disabled: true });
    expect(input.disabled).toBe(true);
    flushSync(() => input.click());
    expect(onChange).not.toHaveBeenCalled();
  });
});

// Export lists its settings as rows: the name first, the switch at the end.
describe('Toggle as a row', () => {
  it('puts the label before the switch and keeps it as the accessible name', () => {
    const { target, input, onChange } = setup({ variant: 'row' });
    const root = target.querySelector('.bava-toggle')!;
    expect(root.getAttribute('data-variant')).toBe('row');
    const label = root.querySelector('.bava-toggle-label')!;
    const track = root.querySelector('.bava-toggle-track')!;
    expect(label.compareDocumentPosition(track) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input.labels?.[0]?.textContent).toContain('Background');
    flushSync(() => input.click());
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
