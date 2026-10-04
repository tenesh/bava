<script lang="ts">
  import SlashMenu from '../../../../src/components/SlashMenu.svelte';
  import { t } from '../../../../src/i18n/t';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';

  const BLOCKS = [
    { id: 'text', label: 'Text', group: 'Basic' },
    { id: 'h1', label: 'Heading 1', group: 'Basic', detail: '#' },
    { id: 'h2', label: 'Heading 2', group: 'Basic', detail: '##' },
    { id: 'todo', label: 'To-do list', group: 'Basic', detail: '[]' },
    { id: 'image', label: 'Image', group: 'Media' },
    { id: 'video', label: 'Online video', group: 'Media' },
    { id: 'equation', label: 'Equation', group: 'Advanced', detail: '$$' },
    { id: 'code', label: 'Code block', group: 'Advanced', detail: '```' },
  ];

  const EMOJI = [
    { id: '0', label: '😀 grinning face' },
    { id: '1', label: '😃 grinning face with big eyes' },
    { id: '2', label: '😄 grinning face with smiling eyes' },
  ];

  // The blocks menu, the emoji menu, and one with nothing matching.
  const menus = [
    { name: 'blocks, the second chosen', typed: '/', items: BLOCKS, label: undefined },
    { name: 'emoji', typed: ':grin', items: EMOJI, label: t('emoji.label') },
    { name: 'no match', typed: '/zzz', items: [], label: undefined },
  ];

  const anchors = $state<(HTMLElement | undefined)[]>([]);
  const at = $state<({ left: number; bottom: number } | null)[]>(menus.map(() => null));
  $effect(() => {
    anchors.forEach((anchor, index) => {
      if (anchor) void settledBox(anchor).then((box) => (at[index] = { left: box.left, bottom: box.bottom }));
    });
  });
</script>

{#each menus as menu, index (menu.name)}
  <Cell name={menu.name} width="18rem" height="22rem">
    <span class="typed" bind:this={anchors[index]}>{menu.typed}</span>
  </Cell>
{/each}

{#each menus as menu, index (menu.name)}
  {@const place = at[index]}
  {#if place}
    <SlashMenu items={menu.items} active={1} at={place} label={menu.label} onChoose={() => {}} />
  {/if}
{/each}

<style>
  .typed {
    color: var(--color-text-prose);
  }
</style>
