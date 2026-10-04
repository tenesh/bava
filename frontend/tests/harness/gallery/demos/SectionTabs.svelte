<script lang="ts">
  import SectionTabs from '../../../../src/components/SectionTabs.svelte';
  import Toggle from '../../../../src/components/Toggle.svelte';
  import ToolIcon from '../../../../src/components/ToolIcon.svelte';
  import Cell from '../Cell.svelte';

  let grid = $state(true);
  let snap = $state(false);

  const cells: { name: string; force?: 'hover' | 'focus' | 'active'; target?: string }[] = [
    { name: 'rest' },
    { name: 'Canvas hovered', force: 'hover', target: '.bava-section-tab:nth-child(2)' },
    { name: 'Canvas pressed', force: 'active', target: '.bava-section-tab:nth-child(2)' },
    { name: 'Appearance focused', force: 'focus', target: '.bava-section-tab:nth-child(1)' },
  ];
</script>

{#snippet appearance()}
  <p class="text">How Bava looks: the theme, and the page's width.</p>
{/snippet}

{#snippet canvas()}
  <div class="rows">
    <Toggle variant="row" label="Show the grid" checked={grid} onChange={(next) => (grid = next)} />
    <Toggle variant="row" label="Snap to objects" checked={snap} onChange={(next) => (snap = next)} />
  </div>
{/snippet}

{#snippet end()}
  <button type="button" class="bava-icon-button" aria-label="Close"><ToolIcon id="close" size="sm" /></button>
{/snippet}

{#each cells as each (each.name)}
  <Cell name={each.name} width="30rem" height="12rem" force={each.force} target={each.target}>
    <SectionTabs
      label="Settings"
      heading="Settings"
      {end}
      sections={[
        { value: 'appearance', label: 'Appearance', icon: 'appearance', content: appearance },
        { value: 'canvas', label: 'Canvas', icon: 'grid', content: canvas },
      ]}
    />
  </Cell>
{/each}

<style>
  .text {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .rows {
    display: flex;
    flex-direction: column;
  }
</style>
