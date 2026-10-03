<script lang="ts">
  import SpaceSettingsDialog from '../../../../../src/components/SpaceSettingsDialog.svelte';

  let open = $state(true);
</script>

<SpaceSettingsDialog bind:open name="Acme Product" root="/Users/you/Documents/Acme Product" pageWidth="" onSave={() => {}} onReveal={() => {}} onOpenChange={(next) => (open = next)} />
