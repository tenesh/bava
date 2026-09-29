<script lang="ts">
  /**
   * An attachment's small picture: the image itself (or a video's poster),
   * else its kind's icon. Presentational: the caller says where it loads from.
   */
  import ToolIcon from './ToolIcon.svelte';
  import type { MediaKind } from '../files/media';

  type Props = {
    kind: MediaKind;
    /** Where its picture loads from; null for its kind's icon. */
    src: string | null;
    size?: 'row' | 'grid';
  };

  let { kind, src, size = 'row' }: Props = $props();

  const ICONS = { image: 'fileImage', video: 'fileVideo', pdf: 'fileText', other: 'document' } as const;
  // A picture that will not load gives way to the icon.
  let failed = $state(false);
</script>

<span class="media-thumb" data-size={size}>
  {#if src && !failed}
    <img {src} alt="" loading="lazy" draggable="false" onerror={() => (failed = true)} />
  {:else}
    <ToolIcon id={ICONS[kind]} size={size === 'grid' ? 'md' : 'sm'} />
  {/if}
</span>

<style>
  .media-thumb {
    display: grid;
    flex: none;
    place-items: center;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--color-surface-sunken);
    color: var(--color-text-muted);
  }

  .media-thumb[data-size='row'] {
    width: var(--size-media-thumb-row);
    height: var(--size-media-thumb-row);
  }

  .media-thumb[data-size='grid'] {
    width: 100%;
    aspect-ratio: var(--ratio-media-thumb);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
