// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import OptionPicker from './OptionPicker.svelte';
import { PROPERTY_OPTIONS } from '../canvas/property-options';
import { t } from '../i18n/t';

afterEach(() => {
  document.body.innerHTML = '';
});

// The real control, not a fixture: a picker that works against invented
// options proves nothing about the ones the toolbar shows.
const control = PROPERTY_OPTIONS.strokeWidth;
const options = control.options;

function render(props: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const onSelect = vi.fn();
  const app = flushSync(() =>
    mount(OptionPicker, {
      target,
      props: { label: t(control.labelKey), options, current: 2, icon: control.icon, onSelect, ...props } as never,
    }),
  );
  const trigger = target.querySelector('button')!;
  return { app, target, trigger, onSelect };
}

describe('OptionPicker', () => {
  it('is one named button until it is opened', () => {
    const { app, target, trigger } = render();
    expect(trigger.getAttribute('aria-label')).toBe(t(control.labelKey));
    expect(trigger.querySelector('svg')).not.toBeNull();
    expect(document.querySelectorAll('[data-part="item"]')).toHaveLength(0);
    unmount(app);
    expect(target.textContent).toBe('');
  });

  it('offers its options and reports the one chosen', async () => {
    const { app, trigger, onSelect } = render();
    flushSync(() => trigger.click());
    await vi.waitFor(() => expect(document.querySelectorAll('[data-part="item"]').length).toBe(options.length));
    const bold = [...document.querySelectorAll('[data-part="item"]')].find((el) =>
      el.textContent?.includes(t('option.bold')),
    ) as HTMLElement;
    flushSync(() => bold.click());
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(4));
    unmount(app);
  });

  it('marks the current option, and none when the selection is mixed', async () => {
    const { app, trigger } = render({ current: 'mixed' });
    flushSync(() => trigger.click());
    await vi.waitFor(() => expect(document.querySelectorAll('[data-part="item"]').length).toBe(options.length));
    expect(document.querySelector('[data-part="item"][data-state="checked"]')).toBeNull();
    unmount(app);

    const chosen = render({ current: 4 });
    flushSync(() => chosen.trigger.click());
    await vi.waitFor(() =>
      expect(document.querySelector('[data-part="item"][data-state="checked"]')?.textContent).toContain(t('option.bold')),
    );
    unmount(chosen.app);
  });
});
