<script lang="ts">
  import ExportDialog, { type ExportSettings } from '../../../../../src/components/ExportDialog.svelte';
  import { exportSvg } from '../data';

  let { variant }: { variant: string } = $props();

  let open = $state(true);
  // svelte-ignore state_referenced_locally
  const hasSelection = variant === 'selection';
  let settings = $state<ExportSettings>(
    hasSelection ? { onlySelected: true, background: false, dark: true, scale: 2 } : { onlySelected: false, background: true, dark: false, scale: 1 },
  );
</script>

<ExportDialog
  bind:open
  {hasSelection}
  {settings}
  preview={exportSvg(settings)}
  onSettings={(change) => (settings = { ...settings, ...change })}
  onExport={() => {}}
  onCopy={() => {}}
/>
