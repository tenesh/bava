<script lang="ts">
  /**
   * The `/` menu's list, under the `/` in the page; the `:` emoji
   * suggestions use it too. Its keys stay in the
   * editor so typing goes on filtering it; this only shows the items and
   * reports a pointer pick.
   *
   * Presentational: the Document editor decides what is listed and active.
   */
  import { Portal } from '@ark-ui/svelte';
  import { portalRoot } from './portal-root';
  import { t } from '../i18n/t';

  type Props = {
    items: { id: string; label: string }[];
    active: number;
    at: { left: number; bottom: number };
    onChoose: (id: string) => void;
    /** What the list is, for a screen reader: the `/` menu unless said otherwise. */
    label?: string;
  };

  let { items, active, at, onChoose, label = t('doc.placeholder') }: Props = $props();
</script>

<Portal container={portalRoot()}>
  <div
    class="bava-menu slash-menu"
    role="listbox"
    aria-label={label}
    style:left={`${at.left}px`}
    style:top={`calc(${at.bottom}px + var(--space-1))`}
  >
    {#each items as item, index (item.id)}
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

  .empty {
    padding: 0 var(--space-2);
    line-height: var(--size-row-lg);
    font-size: var(--text-control);
    color: var(--color-text-muted);
  }
</style>
