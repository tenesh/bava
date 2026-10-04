<script lang="ts">
  import FindBar from '../../../../src/components/FindBar.svelte';
  import Cell from '../Cell.svelte';

  // Each bar as the page shows it: what was typed is put in its field, and the
  // matches the editor would count come in as props.
  const bars: { name: string; typed: string; count: number; index: number; force?: 'hover' | 'focus'; target?: string }[] = [
    { name: 'empty, the field focused', typed: '', count: 0, index: -1, force: 'focus', target: 'input[type="search"]' },
    { name: 'three matches', typed: 'plan', count: 3, index: 0 },
    { name: 'Next hovered', typed: 'plan', count: 3, index: 0, force: 'hover', target: '[aria-label="Next match"]' },
    { name: 'replace focused', typed: 'plan', count: 3, index: 0, force: 'focus', target: '[aria-label="Replace with"]' },
    { name: 'no match', typed: 'zzz', count: 0, index: -1 },
  ];

  function typed(node: HTMLElement, text: string) {
    const field = node.querySelector<HTMLInputElement>('input[type="search"]');
    if (!field || !text) return;
    field.value = text;
    // As typing would: the bar shows its count once it has heard the text.
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
</script>

{#each bars as bar (bar.name)}
  <Cell name={bar.name} width="48rem" force={bar.force} target={bar.target}>
    <div use:typed={bar.typed}>
      <FindBar
        count={bar.count}
        index={bar.index}
        focus={{ field: 'find', at: 0 }}
        onFind={() => {}}
        onNext={() => {}}
        onPrevious={() => {}}
        onReplace={() => {}}
        onReplaceAll={() => {}}
        onClose={() => {}}
      />
    </div>
  </Cell>
{/each}
