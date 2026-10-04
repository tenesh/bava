<script lang="ts">
  /**
   * The gallery's page: the named component's demo, on the app's own ground.
   * Each demo is `demos/<Component>.svelte`, loaded only when asked for.
   */
  import type { Component } from 'svelte';

  type Demo = Component<{ variant: string }>;

  type Props = { name: string; variant: string };

  let { name, variant }: Props = $props();

  const demos = import.meta.glob<{ default: Demo }>('./demos/*.svelte');

  let demo = $state<Demo | null>(null);
  let missing = $state(false);

  $effect(() => {
    const load = demos[`./demos/${name}.svelte`];
    if (!load) {
      missing = true;
      return;
    }
    // The page's own font first: a demo that places something by its text
    // measures that text once, and must measure it in the font it shows in.
    void document.fonts
      .load(getComputedStyle(document.body).font)
      .then(() => document.fonts.ready)
      .then(load)
      .then((module) => (demo = module.default));
  });
</script>

{#if demo}
  {@const Demo = demo}
  <main class="gallery" data-gallery={name}>
    <Demo {variant} />
  </main>
{:else if missing}
  <p data-gallery-missing>No demo for “{name}”.</p>
{/if}

<style>
  /* As wide as what it shows, so a picture of it is cropped to that. */
  .gallery {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--space-4);
    max-width: 100vw;
    padding: var(--space-4);
    box-sizing: border-box;
  }

  /* While a floating piece is pictured, only the cells it belongs to show. */
  .gallery:has(:global([data-pictured])) :global([data-cell]:not([data-pictured])) {
    visibility: hidden;
  }
</style>
