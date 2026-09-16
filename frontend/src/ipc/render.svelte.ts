/**
 * The render client: the frontend half of the one IPC surface.
 *
 * It owns three things the canvas rule is explicit about — a 250ms debounce,
 * an incrementing request id, and dropping responses that are not the latest.
 * Without the id check a slow TALA render can land after a faster later one and
 * the diagram flickers between states, which looks like a layout bug and is not.
 */
import { RenderService } from '../../bindings/github.com/tenesh/bava/internal/app';
import type { Diagnostic, Result, Span } from '../../bindings/github.com/tenesh/bava/internal/render/models';

/** Milliseconds of quiet before a render is issued. */
export const DEBOUNCE_MS = 250;

export type RenderResult = {
  svg: string;
  errors: Diagnostic[];
  nodeMap: Record<string, Span>;
};

export type SendFn = (source: string, engine: string) => Promise<RenderResult>;

/** Normalises the binding's nullable fields into the shape the UI wants. */
function normalise(result: Result): RenderResult {
  return {
    svg: result.svg ?? '',
    errors: result.errors ?? [],
    nodeMap: (result.nodeMap ?? {}) as Record<string, Span>,
  };
}

const sendOverIPC: SendFn = async (source, engine) =>
  normalise(await RenderService.Render(source, { engine }));

export type RenderClientOptions = {
  /** Injectable for tests; defaults to the real binding. */
  send?: SendFn;
  engine?: string;
};

export function createRenderClient(options: RenderClientOptions = {}) {
  const send = options.send ?? sendOverIPC;
  const engine = options.engine ?? '';

  // $state.raw, not $state: these are replaced wholesale on every render and
  // consumed imperatively by the canvas. Deep-proxying a nodeMap of a thousand
  // spans on every property access buys nothing.
  let svg = $state.raw('');
  let errors = $state.raw<Diagnostic[]>([]);
  let nodeMap = $state.raw<Record<string, Span>>({});
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
      }
    } catch (cause) {
      // A rejection here is a malformed request or a transport failure, not a
      // diagram problem — compile errors arrive as data on a successful call.
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
      timer = setTimeout(() => void dispatch(source), DEBOUNCE_MS);
    },

    /** Cancel any queued render. Call from a component's cleanup. */
    destroy() {
      clearTimeout(timer);
      latestRequestID++;
    },
  };
}
