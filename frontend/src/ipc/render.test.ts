import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRenderClient, DEBOUNCE_MS } from './render.svelte';
import type { RenderResult } from './render.svelte';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const ok = (svg: string): RenderResult => ({ svg, errors: [], nodeMap: {} });

describe('render client', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('issues one request after typing stops, not one per keystroke', async () => {
    const send = vi.fn().mockResolvedValue(ok('<svg/>'));
    const client = createRenderClient({ send });

    client.request('a');
    client.request('a -');
    client.request('a -> b');
    expect(send).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe('a -> b');
  });

  // A slow TALA render landing after a faster later one makes the diagram
  // flicker between states. It looks like a layout bug and is not.
  it('drops a response that is not the latest', async () => {
    const first = deferred<RenderResult>();
    const second = deferred<RenderResult>();
    const send = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const client = createRenderClient({ send });

    client.request('first');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    client.request('second');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(send).toHaveBeenCalledTimes(2);

    // The later request answers first, then the stale one arrives.
    second.resolve(ok('<svg id="second"/>'));
    await vi.advanceTimersByTimeAsync(0);
    first.resolve(ok('<svg id="first"/>'));
    await vi.advanceTimersByTimeAsync(0);

    expect(client.state.svg).toBe('<svg id="second"/>');
  });

  // Users type through invalid states constantly. Blanking the canvas on every
  // half-finished line would make the app unusable.
  it('keeps the last good SVG when a response carries errors', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(ok('<svg id="good"/>'))
      .mockResolvedValueOnce({
        svg: '',
        errors: [{ message: 'maps must be terminated with }', from: 4, to: 6, line: 3 }],
        nodeMap: {},
      } satisfies RenderResult);
    const client = createRenderClient({ send });

    client.request('a -> b');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(client.state.svg).toBe('<svg id="good"/>');

    client.request('a -> {');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(client.state.svg).toBe('<svg id="good"/>');
    expect(client.state.errors).toHaveLength(1);
    expect(client.state.errors[0].line).toBe(3);
  });

  it('clears errors once the source compiles again', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        svg: '',
        errors: [{ message: 'boom', from: 0, to: 1, line: 1 }],
        nodeMap: {},
      } satisfies RenderResult)
      .mockResolvedValueOnce(ok('<svg id="fixed"/>'));
    const client = createRenderClient({ send });

    client.request('broken');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(client.state.errors).toHaveLength(1);

    client.request('a -> b');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(client.state.errors).toHaveLength(0);
    expect(client.state.svg).toBe('<svg id="fixed"/>');
  });

  it('debounces at 250ms, the value the layout timings justify', () => {
    expect(DEBOUNCE_MS).toBe(250);
  });
});

describe('render client transport failures', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // An unknown engine, a ruler failure, or any Wails transport error rejects
  // the call. Before this was handled it became an unhandled rejection:
  // nothing reached the user and nothing reached state.
  it('records a rejected call without blanking the diagram', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(ok('<svg id="good"/>'))
      .mockRejectedValueOnce(new Error('unknown layout engine "nomnoml"'));
    const client = createRenderClient({ send });

    client.request('a -> b');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(client.state.svg).toBe('<svg id="good"/>');

    client.request('a -> c');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(client.state.svg).toBe('<svg id="good"/>');
    expect(client.state.failure).toContain('nomnoml');
    expect(client.state.pending).toBe(false);
  });

  it('clears a previous failure once a call succeeds', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('transport gone'))
      .mockResolvedValueOnce(ok('<svg id="back"/>'));
    const client = createRenderClient({ send });

    client.request('a');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(client.state.failure).toBe('transport gone');

    client.request('a -> b');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(client.state.failure).toBeNull();
    expect(client.state.svg).toBe('<svg id="back"/>');
  });
});

describe('configurable debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // The debounce was a compile-time constant until Milestone 5. It now comes
  // from the settings file, with the constant as the fallback.
  it('uses a supplied debounce rather than the default', async () => {
    const send = vi.fn().mockResolvedValue(ok('<svg/>'));
    const client = createRenderClient({ send, debounceMs: 600 });

    client.request('a -> b');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(send).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(600 - DEBOUNCE_MS);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('falls back to the default when none is supplied', async () => {
    const send = vi.fn().mockResolvedValue(ok('<svg/>'));
    const client = createRenderClient({ send });
    client.request('a -> b');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

// The dialog converts the layout of the last good compile, so the client has
// to keep it beside the SVG it previews, under the same staleness rules.
describe('the layout of the last good render', () => {
  it('is kept when a compile succeeds', async () => {
    const send = vi.fn().mockResolvedValue({
      svg: '<svg/>',
      errors: [],
      nodeMap: {},
      layout: { shapes: [{ id: 'a', type: 'rectangle', x: 0, y: 0, w: 10, h: 10 }], connections: [] },
    });
    const client = createRenderClient({ send, debounceMs: 0 });
    client.request('a');
    await vi.waitFor(() => expect(client.state.layout.shapes).toHaveLength(1));
  });

  // Users type through broken states constantly: the last good diagram stays
  // on screen, and so does the layout that Insert would use.
  it('survives a compile that fails', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        svg: '<svg/>',
        errors: [],
        nodeMap: {},
        layout: { shapes: [{ id: 'a', type: 'rectangle', x: 0, y: 0, w: 10, h: 10 }], connections: [] },
      })
      .mockResolvedValueOnce({ svg: '', errors: [{ message: 'broken', line: 1, from: 0, to: 1 }], nodeMap: {}, layout: { shapes: [], connections: [] } });
    const client = createRenderClient({ send, debounceMs: 0 });
    client.request('a');
    await vi.waitFor(() => expect(client.state.layout.shapes).toHaveLength(1));
    client.request('a ->');
    await vi.waitFor(() => expect(client.state.errors).toHaveLength(1));
    expect(client.state.layout.shapes).toHaveLength(1);
  });
});

// The transport itself, not an injected stand-in. Every test above hands the
// client its own `send`, so none of them touches the one line that turns a
// binding's response into what the UI reads: the layout was dropped there and
// Insert did nothing at a running window while the suite stayed green.
describe('the real transport', () => {
  it('carries every part of the response through, layout included', async () => {
    vi.resetModules();
    vi.doMock('../../bindings/github.com/tenesh/bava/internal/app', () => ({
      RenderService: {
        Render: async () => ({
          svg: '<svg/>',
          errors: [],
          nodeMap: {},
          layout: { shapes: [{ id: 'a', type: 'rectangle', x: 0, y: 0, w: 10, h: 10 }], connections: [] },
        }),
      },
    }));
    const { createRenderClient: fresh } = await import('./render.svelte');
    const client = fresh({ debounceMs: 0 });
    client.request('a');
    await vi.waitFor(() => expect(client.state.layout.shapes).toHaveLength(1));
    vi.doUnmock('../../bindings/github.com/tenesh/bava/internal/app');
  });

  it('turns the binding nulls into the empty shapes the UI expects', async () => {
    vi.resetModules();
    vi.doMock('../../bindings/github.com/tenesh/bava/internal/app', () => ({
      RenderService: {
        Render: async () => ({ svg: null, errors: null, nodeMap: null, layout: null }),
      },
    }));
    const { createRenderClient: fresh } = await import('./render.svelte');
    const client = fresh({ debounceMs: 0 });
    client.request('a');
    await vi.waitFor(() => expect(client.state.pending).toBe(false));
    expect(client.state.svg).toBe('');
    expect(client.state.errors).toEqual([]);
    expect(client.state.layout).toEqual({ shapes: [], connections: [] });
    vi.doUnmock('../../bindings/github.com/tenesh/bava/internal/app');
  });
});
