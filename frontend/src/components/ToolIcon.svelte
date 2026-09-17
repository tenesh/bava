<script lang="ts">
  /**
   * An interface icon by id, sized from the icon tokens. Decorative: whatever
   * shows it carries the accessible name. Presentational only.
   */
  import Icon from './Icon.svelte';
  import { iconSizeVar, type IconSize } from './icon';
  import { LUCIDE_ICONS, PARALLELOGRAM_PATH, type IconId } from './tool-icons';

  type Props = {
    id: IconId;
    size?: IconSize;
  };

  let { id, size = 'md' }: Props = $props();

  const Lucide = $derived(id === 'parallelogram' ? null : LUCIDE_ICONS[id]);
</script>

{#if Lucide}
  <span class="tool-icon" style="--icon-size: {iconSizeVar(size)}">
    <Lucide aria-hidden="true" />
  </span>
{:else}
  <Icon path={PARALLELOGRAM_PATH} {size} />
{/if}

<style>
  .tool-icon {
    display: inline-flex;
    flex: none;
    width: var(--icon-size);
    height: var(--icon-size);
  }

  .tool-icon :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
