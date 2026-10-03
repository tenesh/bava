<script lang="ts">
  import NewSpaceDialog from '../../../../../src/components/NewSpaceDialog.svelte';

  let { variant }: { variant: string } = $props();

  let open = $state(true);
  const location = $derived(
    variant === 'located' ? '/Users/you/Documents' : variant === 'long' ? '/Users/you/Library/Mobile Documents/com~apple~CloudDocs/Work/Clients/Acme/Planning' : '',
  );
</script>

<NewSpaceDialog bind:open {location} onChooseLocation={() => {}} onCreate={() => {}} onOpenChange={(next) => (open = next)} />
