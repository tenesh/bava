<script lang="ts">
  /**
   * The gallery's page, on the app's own ground: one component's demo
   * (`name`), or a sheet of a family's demos (`sheet`, from `sheets.ts`), each
   * under its name. Each demo is `demos/<Component>.svelte`, loaded only when
   * asked for.
   */
  import type { Component } from 'svelte';
  import { SHEETS, type Sheet } from './sheets';

  type Demo = Component<{ variant: string }>;

  type Props = { name: string; variant: string; sheet: string };

  let { name, variant, sheet }: Props = $props();

  const demos = import.meta.glob<{ default: Demo }>('./demos/*.svelte');

  let loaded = $state<{ name: string; demo: Demo }[] | null>(null);
  let missing = $state<string[]>([]);

  $effect(() => {
    const names: readonly string[] = sheet ? (SHEETS[sheet as Sheet] ?? []) : [name];
    const absent = names.filter((each) => !demos[`./demos/${each}.svelte`]);
    if (absent.length > 0 || names.length === 0) {
      missing = names.length === 0 ? [sheet] : absent;
      return;
    }
    // The page's own font first: a demo that places something by its text
    // measures that text once, and must measure it in the font it shows in.
    void document.fonts
      .load(getComputedStyle(document.body).font)
      .then(() => document.fonts.ready)
      .then(() => Promise.all(names.map((each) => demos[`./demos/${each}.svelte`]())))
      .then((modules) => (loaded = modules.map((module, index) => ({ name: names[index], demo: module.default }))));
  });
</script>

{#if loaded && sheet}
  <main class="gallery sheet" data-sheet={sheet}>
    {#each loaded as { name: component, demo: Demo } (component)}
      <section class="demo" data-demo={component}>
        <h2>{component}</h2>
        <div class="cells"><Demo variant="" /></div>
      </section>
    {/each}
  </main>
{:else if loaded}
  {@const Demo = loaded[0].demo}
  <main class="gallery" data-gallery={name}>
    <Demo {variant} />
  </main>
{:else if missing.length > 0}
  <p data-gallery-missing>No demo for “{missing.join('”, “')}”.</p>
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

  .sheet {
    flex-direction: column;
    flex-wrap: nowrap;
  }

  h2 {
    margin: 0 0 var(--space-1) var(--space-2);
    font-size: var(--text-label);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .cells {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  /* While a floating piece is pictured, only the cells it belongs to show:
     not the sheet's headings, nor another piece floating open all along. */
  .gallery:has(:global([data-pictured])) :global([data-cell]:not([data-pictured])),
  .gallery:has(:global([data-pictured])) h2 {
    visibility: hidden;
  }

  :global(body:has([data-pictured]) #bava-portal-root > :not([data-pictured]):not(:has([data-pictured]))) {
    visibility: hidden;
  }
</style>
