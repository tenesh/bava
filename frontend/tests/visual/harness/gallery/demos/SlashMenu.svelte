<script lang="ts">
  import SlashMenu from '../../../../../src/components/SlashMenu.svelte';
  import { t } from '../../../../../src/i18n/t';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';

  let { variant }: { variant: string } = $props();

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
  const items = $derived(variant === 'empty' ? [] : variant === 'emoji' ? EMOJI : BLOCKS);

  let anchor: HTMLElement | undefined = $state();
  let at = $state<{ left: number; bottom: number } | null>(null);
  $effect(() => {
    if (anchor) void settledBox(anchor).then((box) => (at = { left: box.left, bottom: box.bottom }));
  });
</script>

<Cell name="under the caret" width="18rem" height="22rem">
  <span class="typed" bind:this={anchor}>{variant === 'emoji' ? ':grin' : variant === 'empty' ? '/zzz' : '/'}</span>
</Cell>
{#if at}
  <SlashMenu {items} active={1} {at} label={variant === 'emoji' ? t('emoji.label') : undefined} onChoose={() => {}} />
{/if}

<style>
  .typed {
    color: var(--color-text-prose);
  }
</style>
