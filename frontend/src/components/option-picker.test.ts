// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render, unmount } from '../test/render';
import OptionPicker from './OptionPicker.svelte';
import { PROPERTY_OPTIONS } from '../canvas/property-options';
import { t } from '../i18n/t';

// The real control, not a fixture: a picker that works against invented
// options proves nothing about the ones the toolbar shows.
const control = PROPERTY_OPTIONS.strokeWidth;
const options = control.options;

function setup(props: Record<string, unknown> = {}) {
  const onSelect = vi.fn();
  const { target, app } = render(OptionPicker, { label: t(control.labelKey), options, current: 2, icon: control.icon, onSelect, ...props } as never);
  const trigger = target.querySelector('button')!;
  return { app, target, trigger, onSelect };
}

describe('OptionPicker', () => {
  it('is one named button until it is opened', () => {
    const { app, target, trigger } = setup();
    expect(trigger.getAttribute('aria-label')).toBe(t(control.labelKey));
    expect(trigger.querySelector('svg')).not.toBeNull();
    expect(document.querySelectorAll('[data-part="item"]')).toHaveLength(0);
    unmount(app);
    expect(target.textContent).toBe('');
  });

  it('offers its options and reports the one chosen', async () => {
    const { trigger, onSelect } = setup();
    flushSync(() => trigger.click());
    await vi.waitFor(() => expect(document.querySelectorAll('[data-part="item"]').length).toBe(options.length));
    const bold = [...document.querySelectorAll('[data-part="item"]')].find((el) =>
      el.textContent?.includes(t('option.bold')),
    ) as HTMLElement;
    flushSync(() => bold.click());
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(4));
  });

  it('marks no option when the selection is mixed', async () => {
    const { trigger } = setup({ current: 'mixed' });
    flushSync(() => trigger.click());
    await vi.waitFor(() => expect(document.querySelectorAll('[data-part="item"]').length).toBe(options.length));
    expect(document.querySelector('[data-part="item"][data-state="checked"]')).toBeNull();
  });

  it('marks the current option', async () => {
    const chosen = setup({ current: 4 });
    flushSync(() => chosen.trigger.click());
    await vi.waitFor(() =>
      expect(document.querySelector('[data-part="item"][data-state="checked"]')?.textContent).toContain(t('option.bold')),
    );
  });
});

// The crow's-foot heads sit behind a More row, as Excalidraw's.
describe("OptionPicker's More row", () => {
  const heads = PROPERTY_OPTIONS.endArrowhead;
  const items = () => document.querySelectorAll('[data-part="item"]').length;
  const main = heads.options.filter((o) => !o.more).length;

  function open(current: string) {
    const { target, app } = render(OptionPicker, { label: t(heads.labelKey), options: heads.options, current, icon: heads.icon, onSelect: vi.fn() } as never);
    flushSync(() => target.querySelector('button')!.click());
    return app;
  }

  it('shows the rest once More is pressed', async () => {
    open('arrow');
    await vi.waitFor(() => expect(items()).toBe(main));
    const more = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(t('option.more'))) as HTMLElement;
    flushSync(() => more.click());
    await vi.waitFor(() => expect(items()).toBe(heads.options.length));
    // Focus goes to the first revealed choice, not the page.
    await vi.waitFor(() => expect((document.activeElement as HTMLInputElement | null)?.value).toBe('one'));
  });

  it('shows the rest at once when the current value is among them', async () => {
    open('zeroOrMany');
    await vi.waitFor(() => expect(items()).toBe(heads.options.length));
  });
});

// Two of the same picker on one page must not share an id, or one's popover
// anchors to the other's button.
describe('OptionPicker ids', () => {
  it('gives each picker its own trigger id', () => {
    const first = setup();
    const second = setup();
    expect(first.trigger.id).not.toBe('');
    expect(first.trigger.id).not.toBe(second.trigger.id);
  });
});
