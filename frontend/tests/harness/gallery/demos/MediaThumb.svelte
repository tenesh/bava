<script lang="ts">
  import MediaThumb from '../../../../src/components/MediaThumb.svelte';
  import Cell from '../Cell.svelte';
  import { MEDIA, thumb } from '../data';

  const [image, , video, pdf, other] = MEDIA;
  // A picture that will not load: no such file on the file route.
  const gone = '/bava-file/?path=.bava/attachments/gone.png';
</script>

<!-- A grid thumbnail fills its tile's width, as in the Media dialog. -->
{#each ['row', 'grid'] as const as size (size)}
  {@const width = size === 'grid' ? '9rem' : undefined}
  <Cell name={`image, ${size}`} {width}><MediaThumb kind="image" src={thumb(image)} {size} /></Cell>
  <Cell name={`video's poster, ${size}`} {width}><MediaThumb kind="video" src={thumb(video)} {size} /></Cell>
  <Cell name={`PDF, ${size}`} {width}><MediaThumb kind="pdf" src={thumb(pdf)} {size} /></Cell>
  <Cell name={`other, ${size}`} {width}><MediaThumb kind="other" src={thumb(other)} {size} /></Cell>
  <Cell name={`not loading, ${size}`} {width}><MediaThumb kind="image" src={gone} {size} /></Cell>
{/each}
