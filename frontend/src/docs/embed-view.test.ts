// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from 'prosemirror-view';
import { schema } from './schema';
import { EMBED_REDRAW_MS, embedView, type EmbedContext } from './embed-view';

const place = { root: '/Space', here: 'Roadmap.md' };

function context(overrides: Partial<EmbedContext> = {}) {
  const watchers: (() => void)[] = [];
  const ctx: EmbedContext = {
    place: () => place,
    probe: async () => true,
    watchPlace: () => () => {},
    relink: () => {},
    draw: vi.fn(async (frame: string) => (frame === 'f1' ? 'blob:live-1' : null)),
    watchCanvas: (redraw) => {
      watchers.push(redraw);
      return () => watchers.splice(watchers.indexOf(redraw), 1);
    },
    holds: vi.fn(async () => true),
    open: vi.fn(),
    ...overrides,
  };
  return { ctx, changed: () => watchers.forEach((watch) => watch()) };
}

const embed = (attrs: Record<string, unknown>) =>
  schema.nodes.embed.create({ frame: 'f1', src: '.bava/attachments/Roadmap%20-%20Box.png', alt: 'Box', ...attrs });
const view = { editable: true } as unknown as EditorView;
const picture = (dom: HTMLElement) => dom.querySelector('img')!;

afterEach(() => {
  vi.useRealTimers();
});

describe('a canvas embed on the page', () => {
  it("draws this page's frame live, and again once the canvas has settled", async () => {
    const { ctx, changed } = context();
    const { dom } = embedView(embed({}), view, () => 0, ctx);
    await vi.waitFor(() => expect(picture(dom as HTMLElement).src).toBe('blob:live-1'));
    vi.useFakeTimers();
    vi.mocked(ctx.draw!).mockClear();
    changed();
    vi.advanceTimersByTime(EMBED_REDRAW_MS - 50);
    // A change before it settles starts the wait again.
    changed();
    vi.advanceTimersByTime(EMBED_REDRAW_MS - 1);
    expect(ctx.draw).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(ctx.draw).toHaveBeenCalledTimes(1);
  });

  it("shows another page's frame from its picture file", async () => {
    const { ctx } = context();
    const { dom } = embedView(embed({ page: 'Engineering/Architecture.md' }), view, () => 0, ctx);
    const url = new URL(picture(dom as HTMLElement).src, 'http://app');
    expect(url.searchParams.get('path')).toBe('.bava/attachments/Roadmap - Box.png');
    expect(ctx.draw).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(ctx.holds).toHaveBeenCalledWith('Engineering/Architecture.md', 'f1'));
    expect((dom as HTMLElement).dataset.deleted).toBeUndefined();
  });

  it('keeps the last picture marked deleted when the frame is gone, and goes live again when it is back', async () => {
    let there = false;
    const { ctx, changed } = context({ draw: vi.fn(async () => (there ? 'blob:live-2' : null)) });
    const { dom } = embedView(embed({}), view, () => 0, ctx);
    const figure = dom as HTMLElement;
    await vi.waitFor(() => expect(figure.dataset.deleted).toBe(''));
    expect(new URL(picture(figure).src, 'http://app').searchParams.get('path')).toBe('.bava/attachments/Roadmap - Box.png');
    expect(figure.textContent).toContain('Frame deleted');
    there = true;
    vi.useFakeTimers();
    changed();
    vi.advanceTimersByTime(EMBED_REDRAW_MS);
    vi.useRealTimers();
    await vi.waitFor(() => expect(figure.dataset.deleted).toBeUndefined());
    expect(picture(figure).src).toBe('blob:live-2');
  });

  it("asks after another page by its path in the Space, not as the page writes it", async () => {
    const { ctx } = context();
    const { dom } = embedView(embed({ page: 'Engineering/Release%20checklist.md' }), view, () => 0, ctx);
    await vi.waitFor(() => expect(ctx.holds).toHaveBeenCalledWith('Engineering/Release checklist.md', 'f1'));
    (dom as HTMLElement).click();
    expect(ctx.open).toHaveBeenCalledWith('f1', 'Engineering/Release checklist.md');
  });

  it("marks another page's frame deleted when that page no longer holds it", async () => {
    const { ctx } = context({ holds: vi.fn(async () => false) });
    const { dom } = embedView(embed({ page: 'Other.md' }), view, () => 0, ctx);
    await vi.waitFor(() => expect((dom as HTMLElement).dataset.deleted).toBe(''));
  });

  it('takes an image’s width, alignment and caption', () => {
    const { ctx } = context();
    const { dom, update } = embedView(embed({ width: 'large', align: 'left', caption: 'The write path' }), view, () => 0, ctx);
    const figure = dom as HTMLElement;
    expect(figure.dataset.width).toBe('large');
    expect(figure.dataset.align).toBe('left');
    expect(figure.querySelector('figcaption')!.textContent).toBe('The write path');
    update!(embed({ width: 'small' }), [], undefined as never);
    expect(figure.dataset.width).toBe('small');
    expect(figure.dataset.align).toBeUndefined();
    expect(figure.querySelector('figcaption')!.hidden).toBe(true);
  });

  it('asks to open its frame, and the page it is on, when clicked', () => {
    const { ctx } = context();
    const { dom } = embedView(embed({ page: 'Other.md' }), view, () => 0, ctx);
    (dom as HTMLElement).click();
    expect(ctx.open).toHaveBeenCalledWith('f1', 'Other.md');
  });
});

describe('a canvas embed with no canvas to draw from', () => {
  it('shows its picture file, never marked deleted', async () => {
    const { ctx } = context({ draw: undefined });
    const { dom } = embedView(embed({}), view, () => 0, ctx);
    expect(new URL(picture(dom as HTMLElement).src, 'http://app').searchParams.get('path')).toBe('.bava/attachments/Roadmap - Box.png');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((dom as HTMLElement).dataset.deleted).toBeUndefined();
  });
});
