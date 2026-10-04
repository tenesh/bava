<script lang="ts">
  import LinkCard from '../../../../src/components/LinkCard.svelte';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';

  type Card = { name: string; href: string; missing: boolean; relinkName: string | null; readOnly?: boolean };

  const ALL: Card[] = [
    { name: 'a link', href: 'https://example.com/docs/getting-started', missing: false, relinkName: null },
    { name: 'a missing page, one to relink to', href: 'Engineering/Road%20map.md', missing: true, relinkName: 'Roadmap' },
    { name: 'a missing page', href: 'Gone.md', missing: true, relinkName: null },
    { name: 'on a locked page', href: 'Engineering/Architecture.md', missing: false, relinkName: null, readOnly: true },
    { name: 'a long address', href: 'https://example.com/a/very/long/address/that/runs/well/past/the/width/of/the/card?with=a&query=string', missing: false, relinkName: null },
  ];
  const cards = ALL;

  const anchors: HTMLElement[] = $state([]);
  let places = $state<({ left: number; bottom: number } | null)[]>([]);
  $effect(() => {
    const shown = anchors.slice(0, cards.length);
    if (shown.length < cards.length || shown.some((anchor) => !anchor)) return;
    void Promise.all(shown.map(settledBox)).then((boxes) => (places = boxes.map((box) => ({ left: box.left, bottom: box.bottom }))));
  });
</script>

<div class="column">
  {#each cards as card, index (card.name)}
    <!-- The first card's Open hovered and its Edit focused. -->
    <Cell
      name={index === 0 ? `${card.name}; Open hovered, Edit focused` : card.name}
      width="26rem"
      height="7rem"
      marks={index === 0
        ? [
            { scope: 'page', target: '.link-card .bava-button:not(.ghost)', force: 'hover' },
            { scope: 'page', target: '.link-card .bava-button.ghost', force: 'focus' },
          ]
        : undefined}
    >
      <span class="link" bind:this={anchors[index]}>{card.href}</span>
    </Cell>
  {/each}
</div>
{#each cards as card, index (card.name)}
  {@const at = places[index]}
  {#if at}
    <LinkCard
      {at}
      href={card.href}
      missing={card.missing}
      relinkName={card.relinkName}
      readOnly={card.readOnly}
      onOpen={() => {}}
      onEdit={() => {}}
      onRemove={() => {}}
      onRelink={() => {}}
      onClose={() => {}}
    />
  {/if}
{/each}

<style>
  .column {
    display: flex;
    flex-direction: column;
  }

  .link {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-accent);
    text-decoration: underline;
  }
</style>
