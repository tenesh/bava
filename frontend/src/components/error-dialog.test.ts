// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ErrorDialog from './ErrorDialog.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.append(target);
  return flushSync(() =>
    mount(ErrorDialog, {
      target,
      props: {
        open: true,
        title: 'Something went wrong',
        body: 'Bava hit a problem it did not expect.',
        details: 'Error id: a1b2c3d4',
        onCopyDetails: vi.fn(),
        onOpenLogs: vi.fn(),
        onClose: vi.fn(),
        ...props,
      },
    }),
  );
}

const content = () => document.querySelector('.error-dialog');
const button = (label: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

describe('ErrorDialog', () => {
  it('hides details until expanded, and copies them', async () => {
    const onCopyDetails = vi.fn();
    const app = render({ onCopyDetails });
    await vi.waitFor(() => expect(content()).not.toBeNull());

    const details = () => document.querySelector('.bava-disclosure-content') as HTMLElement | null;
    const shown = () => {
      const el = details();
      const trigger = document.querySelector('.bava-disclosure-trigger');
      return Boolean(el && !el.hidden && trigger?.getAttribute('aria-expanded') === 'true');
    };
    expect(shown()).toBe(false);

    flushSync(() => button('Details')!.click());
    await vi.waitFor(() => expect(shown()).toBe(true));
    expect(details()!.textContent).toContain('a1b2c3d4');

    flushSync(() => button('Copy details')!.click());
    expect(onCopyDetails).toHaveBeenCalledWith('Error id: a1b2c3d4');
    unmount(app);
  });

  it('opens the logs folder and closes', async () => {
    const onOpenLogs = vi.fn();
    const onClose = vi.fn();
    const app = render({ onOpenLogs, onClose });
    await vi.waitFor(() => expect(content()).not.toBeNull());

    flushSync(() => button('Open logs folder')!.click());
    flushSync(() => button('Close')!.click());
    expect(onOpenLogs).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
    unmount(app);
  });

  // Report Issue is hidden until the public tracker exists (Milestone 16).
  it('offers no Report Issue action yet', async () => {
    const app = render({});
    await vi.waitFor(() => expect(content()).not.toBeNull());
    expect(document.body.textContent).not.toMatch(/report issue/i);
    unmount(app);
  });
});
