<script lang="ts">
  /**
   * One state of a component in the gallery: its name above, the component in
   * a frame below. The frame is positioned, so a component placed absolutely
   * (the tool rail, the zoom buttons) sits inside it, on the ground it has in
   * the app.
   *
   * A cell can show a state no pointer or keyboard is holding: `force` marks
   * the element (`target`, inside the frame, or anywhere on the page with
   * `scope="page"` for a piece drawn in the portal; the frame's first element
   * by default) for the hover, focus or pressed look (`harness/force-states.ts`),
   * and `attrs` sets the attributes a component reads its state from, as Ark's
   * `data-focus-visible`. `marks` lists more, each with its own target, for
   * several states at once. The figure carries `data-forced` once all are set.
   */
  import type { Snippet } from 'svelte';

  type Mark = { target?: string; scope?: 'frame' | 'page'; force?: 'hover' | 'focus' | 'active'; attrs?: Record<string, string> };

  type Props = {
    name: string;
    /** The frame's size, as CSS; by default as large as what it holds. */
    width?: string;
    height?: string;
    /** What the component sits on in the app. */
    ground?: 'surface' | 'nav' | 'canvas';
    force?: 'hover' | 'focus' | 'active';
    target?: string;
    scope?: 'frame' | 'page';
    attrs?: Record<string, string>;
    marks?: Mark[];
    children: Snippet;
  };

  let { name, width, height, ground = 'surface', force, target, scope = 'frame', attrs, marks = [], children }: Props = $props();

  let frame = $state<HTMLDivElement>();
  let forced = $state(false);
  const all = $derived([...(force || attrs ? [{ target, scope, force, attrs }] : []), ...marks]);
  const forcing = $derived(all.length > 0);

  $effect(() => {
    if (!frame || !forcing) return;
    const host = frame;
    const apply = () => {
      let found = 0;
      for (const mark of all) {
        const root = mark.scope === 'page' ? document.body : host;
        const element = mark.target ? root.querySelector(mark.target) : host.firstElementChild;
        if (!element) continue;
        found += 1;
        const set = { ...(mark.force ? { 'data-force': mark.force } : {}), ...mark.attrs };
        for (const [key, value] of Object.entries(set)) if (element.getAttribute(key) !== value) element.setAttribute(key, value);
      }
      if (found === all.length) forced = true;
    };
    apply();
    // What the component draws can arrive after it mounts (a portal, a lazy
    // part), and a component that redraws its element takes the marks off
    // (Ark sets its own `data-focus-visible`): they are put back each time.
    const keys = [...new Set(all.flatMap((mark) => [...(mark.force ? ['data-force'] : []), ...Object.keys(mark.attrs ?? {})]))];
    const observer = new MutationObserver(apply);
    const watch = { childList: true, subtree: true, attributes: true, attributeFilter: keys };
    observer.observe(host, watch);
    if (all.some((mark) => mark.scope === 'page')) observer.observe(document.body, watch);
    return () => observer.disconnect();
  });
</script>

<figure class="cell" data-cell={name} data-forcing={forcing || undefined} data-forced={forced || undefined}>
  <figcaption>{name}</figcaption>
  <div class="frame" data-ground={ground} style:width style:height bind:this={frame}>
    {@render children()}
  </div>
</figure>

<style>
  .cell {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: var(--space-2);
  }

  figcaption {
    font-size: var(--text-label);
    color: var(--color-text-faint);
  }

  .frame {
    position: relative;
  }

  .frame[data-ground='nav'] {
    background: var(--color-surface-nav);
  }

  .frame[data-ground='canvas'] {
    background: var(--color-canvas-bg);
  }
</style>
