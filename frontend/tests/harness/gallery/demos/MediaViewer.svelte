<script lang="ts">
  import MediaViewer from '../../../../src/components/MediaViewer.svelte';
  import Cell from '../Cell.svelte';

  const src = '/bava-file/?path=.bava/attachments/landscape.png';

  let open = $state(false);
</script>

<Cell name="an image on the page">
  <button type="button" class="image" aria-label="Open the image" onclick={() => (open = true)}><img {src} alt="" /></button>
</Cell>
<MediaViewer bind:open {src} alt="A landscape" onOpenChange={(next) => (open = next)} />

<style>
  .image {
    padding: 0;
    border: 0;
    background: none;
  }

  img {
    display: block;
    width: 12rem;
  }
</style>
