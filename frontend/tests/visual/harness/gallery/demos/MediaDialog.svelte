<script lang="ts">
  import MediaDialog from '../../../../../src/components/MediaDialog.svelte';
  import { MEDIA, thumb } from '../data';

  let { variant }: { variant: string } = $props();

  let open = $state(true);
  // Before every page is read, nothing is called unused.
  const items = $derived(variant === 'empty' ? [] : variant === 'unread' ? MEDIA.map((item) => ({ ...item, unused: false })) : MEDIA);
</script>

<MediaDialog
  bind:open
  {items}
  usageKnown={variant !== 'unread'}
  {thumb}
  onOpenChange={(next) => (open = next)}
  onAdd={() => {}}
  onRename={() => {}}
  onDelete={() => {}}
  onReveal={() => {}}
  onOpenPage={() => {}}
  onTrashUnused={() => {}}
/>
