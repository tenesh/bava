<script lang="ts">
  /**
   * The `/` menu's list, under the `/` in the page; the `:` emoji
   * suggestions use it too. Its keys stay in the
   * editor so typing goes on filtering it; this only shows the items and
   * reports a pointer pick.
   *
   * Presentational: the Document editor decides what is listed and active.
   */
  import Portal from './Portal.svelte';
  import { t } from '../i18n/t';

  type Props = {
    /**
     * Items in order; one with a `group` is listed under that group's label,
     * and a `detail` shows quietly after its label.
     */
    items: { id: string; label: string; group?: string; detail?: string }[];
    active: number;
    at: { left: number; bottom: number };
    onChoose: (id: string) => void;
    /** What the list is, for a screen reader: the `/` menu unless said otherwise. */
    label?: string;
  };

  let { items, active, at, onChoose, label = t('doc.placeholder') }: Props = $props();

  let list: HTMLDivElement | undefined = $state();

  // The item chosen with the arrows stays in view as the list scrolls.
  $effect(() => {
    void active;
    list?.querySelector<HTMLElement>('[data-highlighted]')?.scrollIntoView?.({ block: 'nearest' });
  });
</script>

<Portal>
  <div
    bind:this={list}
    class="bava-menu slash-menu"
    role="listbox"
    aria-label={label}
    style:left={`${at.left}px`}
    style:top={`calc(${at.bottom}px + var(--space-1))`}
  >
    {#each items as item, index (item.id)}
      {#if item.group && item.group !== items[index - 1]?.group}
        {#if index > 0}
          <div class="bava-menu-separator" role="separator"></div>
        {/if}
        <div class="slash-group">{item.group}</div>
      {/if}
      <div
        class="bava-menu-item"
        role="option"
        tabindex="-1"
        aria-selected={index === active}
        data-highlighted={index === active ? '' : undefined}
        onmousedown={(event) => {
          event.preventDefault();
          onChoose(item.id);
        }}
      >
        <span class="bava-menu-label">{item.label}</span>
        {#if item.detail}
          <span class="detail">{item.detail}</span>
        {/if}
      </div>
    {:else}
      <div class="empty">{t('slash.none')}</div>
    {/each}
  </div>
</Portal>

<style>
  .slash-menu {
    position: fixed;
    max-height: var(--size-dialog-body-max);
    overflow-y: auto;
  }

  /* A long list scrolls; its rows keep their height. */
  .slash-menu > :global(*) {
    flex-shrink: 0;
  }

  .slash-group {
    padding: var(--space-1) var(--space-2) 0;
    font-size: var(--text-meta);
    font-weight: var(--weight-semibold);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: var(--tracking-label);
    user-select: none;
  }

  .detail {
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  .empty {
    padding: 0 var(--space-2);
    line-height: var(--size-row-lg);
    font-size: var(--text-control);
    color: var(--color-text-muted);
  }
</style>
