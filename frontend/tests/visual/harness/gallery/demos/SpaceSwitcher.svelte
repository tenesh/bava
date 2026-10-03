<script lang="ts">
  import SpaceSwitcher from '../../../../../src/components/SpaceSwitcher.svelte';
  import Cell from '../Cell.svelte';
  import { RECENTS } from '../data';

  let { variant }: { variant: string } = $props();

  const space = $derived(variant === 'long' ? RECENTS[2] : RECENTS[0]);
</script>

<Cell name="atop the side pane" width="16rem" height="16rem" ground="nav">
  <SpaceSwitcher name={space.name} root={space.path} recents={variant === 'alone' ? [] : RECENTS} onSelect={() => {}} />
</Cell>
