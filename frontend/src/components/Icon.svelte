<script lang="ts">
  /** A single wrapper so icon sizing stays tokenised. Presentational only. */
  import { iconSizeVar, type IconSize } from './icon';

  type Props = {
    /** An SVG path `d` attribute, drawn as a line. */
    path: string;
    /** A second path, filled. */
    fill?: string;
    size?: IconSize;
    /** Omit for decorative icons; the label makes it available to a reader. */
    label?: string;
  };

  let { path, fill, size = 'md', label }: Props = $props();
</script>

<svg
  class="icon"
  style="--icon-size: {iconSizeVar(size)}"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : 'presentation'}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <path d={path} />
  {#if fill}<path d={fill} fill="currentColor" />{/if}
</svg>

<style>
  .icon {
    width: var(--icon-size);
    height: var(--icon-size);
    flex: none;
  }
</style>
