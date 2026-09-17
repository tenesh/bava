<script lang="ts">
  /**
   * The panda mark. One drawing at every size, never redrawn, stretched or
   * recoloured.
   *
   * Paper on ink, always: the colour and the tile come from `--color-mark`
   * and `--color-mark-tile`, so on a light theme the mark carries its own ink
   * tile and on a dark theme it sits bare. The tile is always laid out, only
   * transparent in dark, so switching theme does not shift anything.
   */
  import { MARK } from '../brand/mark';

  type Props = {
    /** chrome: title bar · brand: the placement floor · hero: empty states · about. Sizes are `--size-mark-*` tokens. */
    size: 'chrome' | 'brand' | 'hero' | 'about';
    /** Accessible name. Omit when the mark is decorative. */
    label?: string;
  };

  let { size, label }: Props = $props();
</script>

<span class="mark" data-size={size}>
  <svg
    viewBox={MARK.viewBox}
    style:aspect-ratio={MARK.aspectRatio}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : 'true'}
    focusable="false"
  >
    <path fill="currentColor" fill-rule="evenodd" transform={MARK.transform} d={MARK.d} />
  </svg>
</span>

<style>
  .mark {
    display: inline-flex;
    flex: none;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    background: var(--color-mark-tile);
    color: var(--color-mark);
  }

  svg {
    display: block;
    width: auto;
  }

  [data-size='chrome'] svg {
    height: var(--size-mark-chrome);
  }

  [data-size='brand'] svg {
    height: var(--size-mark-brand);
  }

  [data-size='hero'] svg {
    height: var(--size-mark-hero);
  }

  [data-size='about'] svg {
    height: var(--size-mark-about);
  }
</style>
