<script lang="ts">
  /**
   * The canvas tool rail: icon buttons in groups, each with its key in the
   * corner and its name in a tooltip. Insert opens the insert panel and reads
   * as close while it is open. Presentational: it reports choices.
   */
  import { RAIL_GROUPS } from '../canvas/rail';
  import type { ToolId } from '../canvas/tools.svelte';
  import Tooltip from './Tooltip.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import type { IconId } from './tool-icons';
  import { t } from '../i18n/t';

  type Props = {
    active: ToolId;
    insertOpen: boolean;
    onSelect: (tool: ToolId) => void;
    onInsert: () => void;
    /** Whether a drawing tool stays on after it draws (the lock, `Q`). */
    locked?: boolean;
    onLock?: () => void;
  };

  let { active, insertOpen, onSelect, onInsert, locked = false, onLock = () => {} }: Props = $props();

  let rail: HTMLDivElement;

  // Closing the insert panel gives focus back to +, where it came from.
  let wasOpen = false;
  $effect(() => {
    if (wasOpen && !insertOpen) rail.querySelector<HTMLButtonElement>('[data-insert-trigger]')?.focus();
    wasOpen = insertOpen;
  });

  // Arrow keys move along the rail, as a toolbar's should.
  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = [...rail.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  }
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
  class="rail"
  role="toolbar"
  aria-label={t('canvas.tools')}
  aria-orientation="vertical"
  bind:this={rail}
  onkeydown={onKeydown}
>
  {#each RAIL_GROUPS as group, i (i)}
    <div class="group">
      {#each group as item (item.id)}
        {#if item.id === 'insert'}
          {@const label = insertOpen ? t('rail.closeInsert') : t(item.labelKey)}
          <Tooltip
            {label}
            keys={item.key}
            type="button"
            class="bava-rail-button"
            aria-label={label}
            aria-expanded={insertOpen}
            data-insert-trigger={true}
            data-active={insertOpen}
            onclick={onInsert}
          >
            <ToolIcon id={insertOpen ? 'close' : 'insert'} />
            <span class="key" aria-hidden="true">{item.key}</span>
          </Tooltip>
        {:else}
          {@const tool = item.id as ToolId}
          <Tooltip
            label={t(item.labelKey)}
            keys={item.key}
            type="button"
            class="bava-rail-button"
            aria-label={t(item.labelKey)}
            aria-pressed={active === tool}
            data-active={active === tool}
            onclick={() => onSelect(tool)}
          >
            <ToolIcon id={tool as IconId} />
            <span class="key" aria-hidden="true">{item.key}</span>
          </Tooltip>
        {/if}
      {/each}
    </div>
  {/each}
  <!-- The lock ends the rail, set off from the tools by a hairline. -->
  <div class="lock">
    <Tooltip
      label={t('rail.lock')}
      keys="Q"
      type="button"
      class="bava-rail-button"
      aria-label={t('rail.lock')}
      aria-pressed={locked}
      data-active={locked}
      onclick={onLock}
    >
      <ToolIcon id={locked ? 'lock' : 'lockOpen'} />
      <span class="key" aria-hidden="true">Q</span>
    </Tooltip>
  </div>
</div>

<style>
  /* One panel: the groups run on inside it, and the lock is set off beneath. */
  .rail {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
    z-index: var(--z-floating);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-1);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-floating);
  }

  .group,
  .lock {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .lock {
    padding-top: var(--space-1);
    border-top: var(--border-width) solid var(--color-border-subtle);
  }

  :global(.bava-rail-button) {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-rail-button);
    height: var(--size-rail-button);
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-secondary);
  }

  :global(.bava-rail-button:not([data-active='true']):hover:not(:disabled)) {
    background: var(--color-control-hover);
    color: var(--color-text-primary);
  }

  :global(.bava-rail-button:active:not(:disabled)) {
    background: var(--color-control-active);
  }

  :global(.bava-rail-button[data-active='true']) {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  :global(.bava-rail-button:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .key {
    position: absolute;
    right: var(--space-1);
    bottom: 0;
    font-family: var(--font-mono);
    font-size: var(--text-rail-key);
    line-height: var(--leading-tight);
    color: var(--color-text-faint);
  }
</style>
