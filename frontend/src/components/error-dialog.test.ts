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
  // As the mockup shows them: open, one label and value per line.
  it('shows the details as labels and values, and copies them', async () => {
    const onCopyDetails = vi.fn();
    const app = render({ onCopyDetails, details: 'Error id: a1b2c3d4\nError kind: TypeError' });
    await vi.waitFor(() => expect(content()).not.toBeNull());
    expect(document.querySelector('.bava-disclosure-trigger')).toBeNull();
    const cells = [...document.querySelectorAll('.details dt, .details dd')].map((el) => el.textContent);
    expect(cells).toEqual(['Error id', 'a1b2c3d4', 'Error kind', 'TypeError']);
    flushSync(() => button('Copy details')!.click());
    expect(onCopyDetails).toHaveBeenCalledWith('Error id: a1b2c3d4\nError kind: TypeError');
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

  // Report Issue is hidden until the public tracker exists.
  it('offers no Report Issue action yet', async () => {
    const app = render({});
    await vi.waitFor(() => expect(content()).not.toBeNull());
    expect(document.body.textContent).not.toMatch(/report issue/i);
    unmount(app);
  });
});
