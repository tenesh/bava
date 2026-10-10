<script lang="ts">
  import Keycaps from '../../../../src/components/Keycaps.svelte';
  import Cell from '../Cell.svelte';

  const shortcuts = [
    { name: 'one key', keys: 'R' },
    { name: 'modifier and key', keys: '⌘C' },
    { name: 'two modifiers', keys: '⇧⌘]' },
    { name: 'named keys', keys: 'Ctrl+Shift+O' },
  ];
</script>

{#each shortcuts as shortcut (shortcut.name)}
  <Cell name={shortcut.name}>
    <Keycaps keys={shortcut.keys} />
  </Cell>
{/each}
