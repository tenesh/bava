<script lang="ts">
  import AboutDialog from '../../../../src/components/AboutDialog.svelte';

  let open = $state(true);
</script>

<AboutDialog bind:open onOpenChange={(next) => (open = next)} />
