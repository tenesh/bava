<script lang="ts">
  import SpaceSwitcher from '../../../../src/components/SpaceSwitcher.svelte';
  import Cell from '../Cell.svelte';
  import { RECENTS } from '../data';

  let { variant }: { variant: string } = $props();

  const switchers: { name: string; space: (typeof RECENTS)[number]; force?: 'hover' | 'focus' | 'active' }[] = [
    { name: 'at rest', space: RECENTS[0] },
    { name: 'a long name', space: RECENTS[2] },
    { name: 'hovered', space: RECENTS[0], force: 'hover' },
    { name: 'focused', space: RECENTS[0], force: 'focus' },
  ];
</script>

<!-- One switcher to open, with or without recent Spaces; or each look closed. -->
{#if variant === 'open' || variant === 'alone'}
  <Cell name="atop the side pane" width="16rem" height="16rem" ground="nav">
    <SpaceSwitcher name={RECENTS[0].name} root={RECENTS[0].path} recents={variant === 'alone' ? [] : RECENTS} onSelect={() => {}} />
  </Cell>
{:else}
  {#each switchers as each (each.name)}
    <Cell name={each.name} width="16rem" ground="nav" force={each.force} target={each.force ? '.bava-space-switcher' : undefined}>
      <SpaceSwitcher name={each.space.name} root={each.space.path} recents={RECENTS} onSelect={() => {}} />
    </Cell>
  {/each}
{/if}
