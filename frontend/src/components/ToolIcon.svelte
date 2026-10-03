<script lang="ts">
  /**
   * An interface icon by id, sized from the icon tokens. Decorative: whatever
   * shows it carries the accessible name. Presentational only.
   */
  import Icon from './Icon.svelte';
  import { iconSizeVar, type IconSize } from './icon';
  import { DRAWN_ICONS, LUCIDE_ICONS, type IconId } from './tool-icons';

  type Props = {
    id: IconId;
    size?: IconSize;
  };

  let { id, size = 'md' }: Props = $props();

  const drawn = $derived(DRAWN_ICONS[id]);
  const Lucide = $derived(drawn ? null : LUCIDE_ICONS[id as keyof typeof LUCIDE_ICONS]);
</script>

{#if Lucide}
  <span class="tool-icon" style="--icon-size: {iconSizeVar(size)}">
    <Lucide aria-hidden="true" />
  </span>
{:else if drawn}
  <Icon path={drawn.stroke} fill={drawn.fill} {size} />
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
