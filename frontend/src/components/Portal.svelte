<script lang="ts">
  /**
   * Draws what it holds in the portal root, above the window's chrome, while
   * it stays part of the component that renders it.
   *
   * Ark's Portal mounts its content a tick later, as a root of its own: that
   * root can redraw from a place its caller has already dropped (and read
   * null), and it mounts anyway when its caller is gone before the tick, left
   * in the page for good. This one moves its element into the portal root
   * instead, so the content is drawn, redrawn and taken down with its caller,
   * as anything else in its tree is. Events still reach it: Svelte listens on
   * the document for content moved out of its root.
   */
  import type { Snippet } from 'svelte';
  import { portalRoot } from './portal-root';

  let { children }: { children: Snippet } = $props();

  function intoRoot(node: HTMLElement) {
    portalRoot().append(node);
    return () => node.remove();
  }
</script>

<!-- The host stays where the caller put it; only the inner element moves. -->
<div class="host">
  <div class="layer" {@attach intoRoot}>{@render children()}</div>
</div>

<style>
  .host,
  .layer {
    display: contents;
  }
</style>
