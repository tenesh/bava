<script lang="ts">
  /**
   * An image full screen, over the app: Escape or a click outside it leaves.
   *
   * Presentational: it shows the image it is given; the Document opens it.
   */
  import Dialog from './Dialog.svelte';
  import { t } from '../i18n/t';

  type Props = {
    open: boolean;
    /** Where the image loads from. */
    src: string;
    /** Its words, which name the dialog too. */
    alt: string;
    onOpenChange: (open: boolean) => void;
  };

  let { open = $bindable(), src, alt, onOpenChange }: Props = $props();
</script>

<Dialog bind:open title={alt || t('media.image')} size="viewer" headless flush unmountWhenClosed {onOpenChange}>
  <div class="media-viewer">
    <img {src} {alt} />
  </div>
</Dialog>

<style>
  .media-viewer {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    background: var(--color-surface-sunken);
  }

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
</style>
