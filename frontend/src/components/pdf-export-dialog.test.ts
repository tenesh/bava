// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import PageExportDialog from './PageExportDialog.svelte';
import NumberField from './NumberField.svelte';

const plan = { files: [{ path: 'Launch plan.md', size: 1024 }], error: '' };
const page = { html: '<div class="bava-print"><h1>Launch plan</h1></div>', css: '', widthPx: 640 };

function open(props: Record<string, unknown> = {}) {
  const onExportPdf = vi.fn();
  const onExport = vi.fn();
  render(PageExportDialog, {
    open: true,
    pageName: 'Launch plan',
    plan,
    onExport,
    onExportPdf,
    pdf: { paper: 'A4', offered: ['document', 'canvas', 'both'], include: 'document', page, canvas: null },
    formats: ['pdf', 'zip'],
    ...props,
  } as never);
  return { onExportPdf, onExport };
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === name);
const item = (text: string) => [...document.querySelectorAll<HTMLElement>('[data-part="item"]')].find((el) => (el.textContent ?? '').trim() === text);
const field = (name: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`);

describe('PageExportDialog as a PDF', () => {
  it('starts on PDF and reports the setup, what is included, the theme and numbers', async () => {
    const { onExportPdf } = open();
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    flushSync(() => item('Dark')!.click());
    flushSync(() => item('Both')!.click());
    button('Export PDF')!.click();
    expect(onExportPdf).toHaveBeenCalledWith({
      setup: { paper: 'A4', widthMM: 0, heightMM: 0, landscape: false, margins: { top: 20, right: 20, bottom: 20, left: 20 }, background: true },
      include: 'both',
      dark: true,
      numbers: false,
    });
  });

  it("shows Custom paper's fields and reports their size", async () => {
    const { onExportPdf } = open({ initial: { paper: 'Custom', custom: { width: 594, height: 841 } } });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(field('Width')?.value).toBe('594');
    expect(field('Height')?.value).toBe('841');
    button('Export PDF')!.click();
    expect(onExportPdf.mock.calls[0][0].setup).toMatchObject({ paper: 'Custom', widthMM: 594, heightMM: 841 });
  });

  it('says why margins that leave no room cannot be printed, and offers no export', async () => {
    open({ initial: { paper: 'A5', margins: 'custom', customMargins: { top: 0, right: 80, bottom: 0, left: 80 } } });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(dialog().textContent).toContain('These margins leave no room on the paper.');
    expect(button('Export PDF')?.disabled).toBe(true);
  });

  it('offers no Include choice when only the Document can be printed', async () => {
    open({ pdf: { paper: 'A4', offered: ['document'], include: 'document', page, canvas: null } });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(item('Both')).toBeUndefined();
  });

  it('previews the first sheet in the theme chosen', async () => {
    open();
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    const frame = () => dialog().querySelector<HTMLIFrameElement>('iframe');
    expect(frame()?.getAttribute('srcdoc')).toContain('Launch plan');
    expect(frame()?.getAttribute('srcdoc')).toContain('data-theme="light"');
    flushSync(() => item('Dark')!.click());
    expect(frame()?.getAttribute('srcdoc')).toContain('data-theme="dark"');
    expect(frame()?.getAttribute('sandbox')).toBe('allow-same-origin');
  });

  it("switches to the Markdown zip and shows what it holds", async () => {
    const { onExport } = open();
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    flushSync(() => item('Markdown zip')!.click());
    expect(dialog().textContent).toContain('1 page');
    button('Export zip')!.click();
    expect(onExport).toHaveBeenCalledOnce();
  });

  // The paper is known before the page is drawn, so it is offered from the start.
  it("starts at the region's paper, given before the page is drawn", async () => {
    open({ pdf: null, paper: 'Letter' });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(dialog().querySelector('[data-name="Paper"] .bava-select-trigger')?.textContent?.trim()).toBe('Letter');
  });

  it('converts Custom sizes when the unit changes', async () => {
    const { onExportPdf } = open({ initial: { paper: 'Custom', custom: { width: 254, height: 508 } } });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    flushSync(() => item('in')!.click());
    expect(field('Width')?.value).toBe('10');
    button('Export PDF')!.click();
    expect(onExportPdf.mock.calls[0][0].setup.widthMM).toBeCloseTo(254);
  });

  it('waits for the page to be drawn before a PDF can be exported', async () => {
    open({ pdf: null });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(button('Export PDF')?.disabled).toBe(true);
  });

  it('offers only PDF for a page outside a Space', async () => {
    open({ formats: ['pdf'] });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(item('Markdown zip')).toBeUndefined();
    expect(button('Export PDF')).toBeDefined();
  });
});

describe('NumberField', () => {
  it('shows its value and reports a number typed', async () => {
    const onValueChange = vi.fn();
    render(NumberField, { label: 'Width', value: 210, onValueChange } as never);
    const input = field('Width')!;
    expect(input.value).toBe('210');
    input.focus();
    input.value = '297';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(onValueChange).toHaveBeenCalledWith(297));
  });
});
