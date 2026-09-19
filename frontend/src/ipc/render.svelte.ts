/**
 * The render client: the frontend half of the one IPC surface.
 *
 * It owns three things the canvas rule is explicit about: a 250ms debounce,
 * an incrementing request id, and dropping responses that are not the latest.
 * Without the id check a slow TALA render can land after a faster later one and
 * the diagram flickers between states, which looks like a layout bug and is not.
 */
import { RenderService } from '../../bindings/github.com/tenesh/bava/internal/app';
import type {
  Diagnostic,
  Layout as WireLayout,
  Result,
  Span,
} from '../../bindings/github.com/tenesh/bava/internal/render/models';

/** The layout with its lists present, which is what every reader wants. */
export type Layout = { shapes: NonNullable<WireLayout['shapes']>; connections: NonNullable<WireLayout['connections']> };


/**
 * Milliseconds of quiet before a render is issued.
 *
 * The default, and the fallback when settings cannot be read. The user's value
 * comes from the settings file via `createRenderClient({ debounceMs })`; it
 * was a compile-time constant until Milestone 5.
 */
export const DEBOUNCE_MS = 250;

export type RenderResult = {
  svg: string;
  errors: Diagnostic[];
  nodeMap: Record<string, Span>;
  /** The geometry a diagram is built from. Absent in older responses. */
  layout?: Layout;
};

export type SendFn = (source: string, engine: string) => Promise<RenderResult>;

/**
 * Normalises the binding's nullable fields into the shape the UI wants.
 *
 * Every field the UI reads has to be carried here: this is the only place the
 * real response is translated, and a field left out is simply absent at a
 * running window however green the suite is.
 */
function normalise(result: Result): RenderResult {
  const layout = result.layout as WireLayout | null | undefined;
  return {
    svg: result.svg ?? '',
    errors: result.errors ?? [],
    nodeMap: (result.nodeMap ?? {}) as Record<string, Span>,
    layout: {
      shapes: layout?.shapes ?? [],
      connections: layout?.connections ?? [],
    },
  };
}

const sendOverIPC: SendFn = async (source, engine) =>
  normalise(await RenderService.Render(source, { engine }));

export type RenderClientOptions = {
  /** Injectable for tests; defaults to the real binding. */
  send?: SendFn;
  engine?: string;
  /** From the settings file; falls back to DEBOUNCE_MS. */
  debounceMs?: number;
};

export function createRenderClient(options: RenderClientOptions = {}) {
  const send = options.send ?? sendOverIPC;
  const engine = options.engine ?? '';
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS;

  // $state.raw, not $state: these are replaced wholesale on every render and
  // consumed imperatively by the canvas. Deep-proxying a nodeMap of a thousand
  // spans on every property access buys nothing.
  let svg = $state.raw('');
  let errors = $state.raw<Diagnostic[]>([]);
  let nodeMap = $state.raw<Record<string, Span>>({});
  // The geometry the canvas builds shapes from, kept beside the SVG it
  // previews: Insert converts the last good one.
  let layout = $state.raw<Layout>({ shapes: [], connections: [] });
  let pending = $state.raw(false);
  let failure = $state.raw<string | null>(null);

  let latestRequestID = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function dispatch(source: string) {
    const id = ++latestRequestID;
    pending = true;
    try {
      const result = await send(source, engine);
      // Anything but the newest response is discarded, however good it is.
      if (id !== latestRequestID) return;
      failure = null;
      errors = result.errors;
      if (result.errors.length === 0) {
        // Only a successful compile replaces the diagram. Users type through
        // invalid states constantly; blanking the canvas would be unusable.
        svg = result.svg;
        nodeMap = result.nodeMap;
        if (result.layout) layout = result.layout;
      }
    } catch (cause) {
      // A rejection here is a malformed request or a transport failure, not a
      // diagram problem: compile errors arrive as data on a successful call.
      // It must still reach the user rather than becoming an unhandled
      // rejection that silently does nothing.
      if (id !== latestRequestID) return;
      failure = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (id === latestRequestID) pending = false;
    }
  }

  return {
    // Getters, so reads stay reactive across the module boundary without the
    // values themselves being proxied.
    state: {
      get svg() {
        return svg;
      },
      get errors() {
        return errors;
      },
      get nodeMap() {
        return nodeMap;
      },
      get layout() {
        return layout;
      },
      get pending() {
        return pending;
      },
      /** Transport or caller failure, distinct from compile diagnostics. */
      get failure() {
        return failure;
      },
    },

    /** Queue a render. Repeated calls within DEBOUNCE_MS collapse into one. */
    request(source: string) {
      clearTimeout(timer);
      timer = setTimeout(() => void dispatch(source), debounceMs);
    },

    /** Cancel any queued render. Call from a component's cleanup. */
    destroy() {
      clearTimeout(timer);
      latestRequestID++;
    },
  };
}
