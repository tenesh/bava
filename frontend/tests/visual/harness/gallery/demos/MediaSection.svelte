<script lang="ts">
  import MediaSection from '../../../../../src/components/MediaSection.svelte';
  import Cell from '../Cell.svelte';
  import { MEDIA, thumb } from '../data';

  let { variant }: { variant: string } = $props();
</script>

<Cell name="under Files" width="16rem" ground="nav">
  <MediaSection items={variant === 'empty' ? [] : MEDIA} {thumb} onAdd={() => {}} onOpenDialog={() => {}} onPlace={() => {}} />
</Cell>
