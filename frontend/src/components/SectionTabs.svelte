<script module lang="ts">
  import type { Snippet } from 'svelte';
  import type { IconId } from './tool-icons';

  export type Section = { value: string; label: string; icon: IconId; content: Snippet };
</script>

<script lang="ts">
  /**
   * Sections chosen from a list on the left, one shown at a time: Settings'
   * layout. Wraps Ark's Tabs, vertical, so the list is arrow-key
   * navigable and each panel is labelled by its tab.
   *
   * The list is a full-height panel headed by `heading`; each item leads with
   * its section's icon. Each panel opens with a header naming its section,
   * with `end` (a close button) at the header's end.
   *
   * Presentational: each section brings its own content.
   */
  import { Tabs } from '@ark-ui/svelte';
  import ToolIcon from './ToolIcon.svelte';

  type Props = {
    sections: Section[];
    label: string;
    /** Shown atop the list. */
    heading?: string;
    /** Controls at the end of each panel's header. */
    end?: Snippet;
  };

  let { sections, label, heading, end }: Props = $props();
</script>

<Tabs.Root orientation="vertical" defaultValue={sections[0]?.value} class="bava-section-tabs">
  <div class="bava-section-nav">
    {#if heading}<span class="bava-section-heading">{heading}</span>{/if}
    <Tabs.List class="bava-section-list" aria-label={label}>
      {#each sections as section (section.value)}
        <Tabs.Trigger value={section.value} class="bava-section-tab">
          <ToolIcon id={section.icon} />
          {section.label}
        </Tabs.Trigger>
      {/each}
    </Tabs.List>
  </div>
  {#each sections as section (section.value)}
    <Tabs.Content value={section.value} class="bava-section-panel">
      <div class="bava-section-header">
        <h2 class="bava-section-title">{section.label}</h2>
        {#if end}<span class="bava-section-end">{@render end()}</span>{/if}
      </div>
      <div class="bava-section-body">
        {@render section.content()}
      </div>
    </Tabs.Content>
  {/each}
</Tabs.Root>

<style>
  :global(.bava-section-tabs) {
    display: grid;
    grid-template-columns: var(--size-settings-nav) minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  }

  .bava-section-nav {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: var(--space-4) var(--space-2);
    box-sizing: border-box;
    border-right: var(--border-width) solid var(--color-border-subtle);
    background: var(--color-surface-nav);
    overflow: auto;
  }

  .bava-section-heading {
    padding: 0 calc(var(--space-2) + var(--space-half)) var(--space-3);
    font-size: var(--text-title);
    font-weight: var(--weight-semibold);
    color: var(--color-text-primary);
  }

  :global(.bava-section-list) {
    display: flex;
    flex-direction: column;
    gap: var(--space-half);
  }

  :global(.bava-section-tab) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--size-row-xl);
    padding: 0 calc(var(--space-2) + var(--space-half));
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-secondary);
    font: inherit;
    font-size: var(--text-control);
    text-align: left;
  }

  :global(.bava-section-tab:hover) {
    background: var(--color-accent-subtle);
  }

  :global(.bava-section-tab[data-selected]) {
    background: var(--color-selection);
    color: var(--color-text-primary);
  }

  :global(.bava-section-tab:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
  }

  :global(.bava-section-panel) {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    outline: none;
  }

  :global(.bava-section-panel[hidden]) {
    display: none;
  }

  .bava-section-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: calc(var(--space-3) + var(--space-half)) var(--space-5);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
  }

  .bava-section-title {
    margin: 0;
    font-size: var(--text-title);
    font-weight: var(--weight-semibold);
  }

  .bava-section-end {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-inline-start: auto;
  }

  .bava-section-body {
    flex: 1 1 auto;
    min-height: 0;
    padding: var(--space-5);
    overflow: auto;
  }
</style>
