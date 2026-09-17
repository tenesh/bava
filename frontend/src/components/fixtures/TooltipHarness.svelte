<script lang="ts">
  /** Test fixture: a Tooltip around a plain trigger label. */
  import Tooltip from '../Tooltip.svelte';

  type Props = { label: string; keys?: string };
  let { label, keys }: Props = $props();
</script>

<Tooltip {label} {keys} type="button">trigger</Tooltip>
