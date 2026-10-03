// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import ErrorDialog from './ErrorDialog.svelte';

function setup(props: Record<string, unknown>) {
  return render(ErrorDialog, {
    open: true,
    title: 'Something went wrong',
    body: 'Bava hit a problem it did not expect.',
    details: 'Error id: a1b2c3d4',
    onCopyDetails: vi.fn(),
    onOpenLogs: vi.fn(),
    onClose: vi.fn(),
    ...props,
  });
}

const content = () => document.querySelector('.error-dialog');
const button = (label: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

describe('ErrorDialog', () => {
  // As the mockup shows them: open, one label and value per line.
  it('shows the details as labels and values, and copies them', async () => {
    const onCopyDetails = vi.fn();
    setup({ onCopyDetails, details: 'Error id: a1b2c3d4\nError kind: TypeError' });
    await vi.waitFor(() => expect(content()).not.toBeNull());
    expect(document.querySelector('.bava-disclosure-trigger')).toBeNull();
    const cells = [...document.querySelectorAll('.details dt, .details dd')].map((el) => el.textContent);
    expect(cells).toEqual(['Error id', 'a1b2c3d4', 'Error kind', 'TypeError']);
    flushSync(() => button('Copy details')!.click());
    expect(onCopyDetails).toHaveBeenCalledWith('Error id: a1b2c3d4\nError kind: TypeError');
  });

  it('opens the logs folder and closes', async () => {
    const onOpenLogs = vi.fn();
    const onClose = vi.fn();
    setup({ onOpenLogs, onClose });
    await vi.waitFor(() => expect(content()).not.toBeNull());

    flushSync(() => button('Open logs folder')!.click());
    flushSync(() => button('Close')!.click());
    expect(onOpenLogs).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  // Report Issue is hidden until the public tracker exists.
  it('offers no Report Issue action yet', async () => {
    setup({});
    await vi.waitFor(() => expect(content()).not.toBeNull());
    expect(document.body.textContent).not.toMatch(/report issue/i);
  });
});
