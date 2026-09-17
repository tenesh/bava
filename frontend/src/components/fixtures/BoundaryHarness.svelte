<script lang="ts">
  /** Test fixture: a PanelBoundary around a Thrower. */
  import PanelBoundary from '../PanelBoundary.svelte';
  import Thrower from './Thrower.svelte';

  type Props = { broken: { value: boolean }; onError: (error: unknown) => void };
  let { broken, onError }: Props = $props();
</script>

<PanelBoundary name="Canvas" {onError}>
  <Thrower {broken} />
</PanelBoundary>
