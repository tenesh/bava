<script lang="ts">
  /**
   * A PDF's first sheet as the app lays it out at the paper, margins and
   * theme chosen: the page in a frame of its own, the paper's size, shrunk
   * to the preview's width. Not a printed PDF, which takes too long to redo
   * at each change.
   *
   * Presentational: it draws the HTML and styles it is given.
   */
  import { t } from '../i18n/t';
  import { firstSheet } from '../files/pdf-preview';
  import type { Include, PageSetup } from '../files/export-pdf';

  type Props = {
    /** The page as drawn for printing, and the styles it is drawn with. */
    page: { html: string; css: string; widthPx: number } | null;
    /** The Canvas as a picture, or null when it holds nothing. */
    canvas: { svg: string; width: number; height: number } | null;
    include: Include;
    setup: PageSetup;
    dark: boolean;
  };

  let { page, canvas, include, setup, dark }: Props = $props();

  // The sheet's drawn width, `--size-export-preview`, as laid out.
  let shown = $state(0);

  const preview = $derived(firstSheet({ page, canvas, include, setup, dark }));
  const scale = $derived(preview && shown ? shown / preview.width : 0);
</script>

<div class="bava-pdf-preview" aria-label={t('export.pdf.preview')} role="img">
  {#if preview}
    <div class="sheet" bind:clientWidth={shown} style:height="{preview.height * scale}px">
      <iframe
        title={t('export.pdf.preview')}
        tabindex="-1"
        sandbox="allow-same-origin"
        srcdoc={preview.srcdoc}
        style:width="{preview.width}px"
        style:height="{preview.height}px"
        style:transform="scale({scale})"
      ></iframe>
    </div>
  {/if}
</div>

<style>
  .bava-pdf-preview {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--color-surface-sunken);
  }

  .sheet {
    position: relative;
    width: var(--size-export-preview);
    overflow: hidden;
    box-shadow: var(--shadow-raised);
  }

  iframe {
    position: absolute;
    top: 0;
    left: 0;
    border: 0;
    transform-origin: top left;
    pointer-events: none;
  }
</style>
