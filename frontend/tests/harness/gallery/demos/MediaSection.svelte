<script lang="ts">
  import MediaSection from '../../../../src/components/MediaSection.svelte';
  import Cell from '../Cell.svelte';
  import { MEDIA, thumb } from '../data';

  const sections: { name: string; empty?: boolean; search?: string; marks?: { target: string; force: 'hover' | 'focus' }[] }[] = [
    { name: 'files' },
    {
      name: 'the second hovered, the first focused',
      marks: [
        { target: 'li:nth-child(2) .media-row', force: 'hover' },
        { target: 'li:nth-child(1) .media-row', force: 'focus' },
      ],
    },
    { name: 'no match', search: 'zzz' },
    { name: 'no files', empty: true },
  ];

  // What was searched, put in the field as typing would.
  function searched(node: HTMLElement, text: string | undefined) {
    const field = node.querySelector<HTMLInputElement>('input[type="search"]');
    if (!field || !text) return;
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
</script>

{#each sections as section (section.name)}
  <Cell name={section.name} width="16rem" ground="nav" marks={section.marks}>
    <div use:searched={section.search}>
      <MediaSection items={section.empty ? [] : MEDIA} {thumb} onAdd={() => {}} onOpenDialog={() => {}} onPlace={() => {}} />
    </div>
  </Cell>
{/each}
