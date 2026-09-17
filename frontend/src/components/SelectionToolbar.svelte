<script lang="ts">
  /**
   * The selection toolbar at the bottom of the canvas: the colour pickers the
   * selection takes, align and distribute when there are enough units, and
   * More, which opens the same actions as a right-click.
   *
   * Presentational: it reports a colour, a command id, or where More sits.
   */
  import StyleBar from './StyleBar.svelte';
  import Tooltip from './Tooltip.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import type { IconId } from './tool-icons';
  import type { StyleKey } from '../canvas/style';
  import type { MessageKey } from '../i18n/messages';
  import { t } from '../i18n/t';

  type Current = string | null | 'mixed' | 'unavailable';

  type Props = {
    styles: Record<StyleKey, Current>;
    /** The formatted key for a command, when it has one. */
    keysFor?: (id: string) => string;
    align: boolean;
    distribute: boolean;
    onApply: (key: StyleKey, swatch: string | null) => void;
    onCommand: (id: string) => void;
    /** Viewport point above the More button, where its menu opens. */
    onMore: (anchor: { x: number; y: number }) => void;
  };

  let { styles, align, distribute, keysFor = () => '', onApply, onCommand, onMore }: Props = $props();

  type Action = { id: string; icon: IconId; labelKey: MessageKey };

  const ALIGN: Action[] = [
    { id: 'canvas.alignLeft', icon: 'alignLeft', labelKey: 'align.left' },
    { id: 'canvas.alignCenter', icon: 'alignCenter', labelKey: 'align.center' },
    { id: 'canvas.alignRight', icon: 'alignRight', labelKey: 'align.right' },
    { id: 'canvas.alignTop', icon: 'alignTop', labelKey: 'align.top' },
    { id: 'canvas.alignMiddle', icon: 'alignMiddle', labelKey: 'align.middle' },
    { id: 'canvas.alignBottom', icon: 'alignBottom', labelKey: 'align.bottom' },
  ];

  const DISTRIBUTE: Action[] = [
    { id: 'canvas.distributeHorizontal', icon: 'distributeHorizontal', labelKey: 'align.distributeHorizontal' },
    { id: 'canvas.distributeVertical', icon: 'distributeVertical', labelKey: 'align.distributeVertical' },
  ];

  const actions = $derived([...(align ? ALIGN : []), ...(distribute ? DISTRIBUTE : [])]);

  function more(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    onMore({ x: rect.left, y: rect.top });
  }
</script>

<div class="toolbar" role="toolbar" aria-label={t('toolbar.label')}>
  <StyleBar fill={styles.fill} stroke={styles.stroke} color={styles.color} {onApply} />

  {#if actions.length > 0}
    <span class="divider" aria-hidden="true"></span>
    {#each actions as action (action.id)}
      <Tooltip
        label={t(action.labelKey)}
        keys={keysFor(action.id)}
        placement="top"
        type="button"
        class="bava-toolbar-button"
        aria-label={t(action.labelKey)}
        onclick={() => onCommand(action.id)}
      >
        <ToolIcon id={action.icon} />
      </Tooltip>
    {/each}
  {/if}

  <span class="divider" aria-hidden="true"></span>
  <Tooltip
    label={t('toolbar.more')}
    placement="top"
    type="button"
    class="bava-toolbar-button"
    aria-label={t('toolbar.more')}
    onclick={more}
  >
    <ToolIcon id="more" />
  </Tooltip>
</div>

<style>
  .toolbar {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-floating);
  }

  .divider {
    align-self: stretch;
    width: var(--border-width);
    margin: var(--space-1) 0;
    background: var(--color-border-subtle);
  }

  :global(.bava-toolbar-button) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-row);
    height: var(--size-row);
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-secondary);
  }

  :global(.bava-toolbar-button:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }
</style>
