<script lang="ts">
  import TrashDialog from '../../../../src/components/TrashDialog.svelte';
  import { TRASH } from '../data';

  let { variant }: { variant: string } = $props();

  let open = $state(true);
</script>

<TrashDialog
  bind:open
  items={variant === 'empty' ? [] : TRASH}
  total={variant === 'empty' ? '0 KB' : '142 KB'}
  onRestore={() => {}}
  onDelete={() => {}}
  onEmpty={() => {}}
  onOpenChange={(next) => (open = next)}
/>
