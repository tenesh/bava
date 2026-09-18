<script lang="ts">
  /**
   * The selection toolbar at the bottom of the canvas: the controls the
   * selection takes, grouped, then align and distribute, then More.
   *
   * One adaptive row (canvas-toolbar.md): what does not fit moves into More
   * rather than the row wrapping or scrolling. Presentational: it reports a
   * colour, a property, a command id, or where More sits.
   */
  import OpacityPicker from './OpacityPicker.svelte';
  import OptionPicker from './OptionPicker.svelte';
  import StyleBar from './StyleBar.svelte';
  import Tooltip from './Tooltip.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import type { IconId } from './tool-icons';
  import { splitForWidth, type ToolbarControl } from '../canvas/toolbar';
  import { PROPERTY_OPTIONS } from '../canvas/property-options';
  import type { PropertyKey, PropertyValue, StyleKey } from '../canvas/style';
  import type { MessageKey } from '../i18n/messages';
  import { t } from '../i18n/t';

  type Current = string | null | 'mixed' | 'unavailable';

  type Props = {
    styles: Record<StyleKey, Current>;
    /** The controls this selection takes, in row order. */
    controls?: ToolbarControl[];
    /** What each property control should show. */
    properties?: Partial<Record<PropertyKey, PropertyValue | null | 'mixed' | 'unavailable'>>;
    align: boolean;
    distribute: boolean;
    /** How many controls the row has room for; the rest move into More. */
    capacity?: number;
    keysFor?: (id: string) => string;
    onApply: (key: StyleKey, swatch: string | null) => void;
    onProperty: (key: PropertyKey, value: PropertyValue) => void;
    onCommand: (id: string) => void;
    /** Viewport point above the More button, where its menu opens. */
    onMore: (anchor: { x: number; y: number }, overflow: ToolbarControl[]) => void;
  };

  let {
    styles,
    controls = [],
    properties = {},
    align,
    distribute,
    capacity = Number.MAX_SAFE_INTEGER,
    keysFor = () => '',
    onApply,
    onProperty,
    onCommand,
    onMore,
  }: Props = $props();

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

  // Colours are one control in the row (the chips), whatever their number.
  const colours = $derived(
    controls.some((control) => control.kind === 'colour') ||
      Object.values(styles).some((value) => value !== 'unavailable'),
  );
  const rest = $derived(controls.filter((control) => control.kind !== 'colour'));
  const split = $derived(splitForWidth(rest, Math.max(1, capacity - (colours ? 1 : 0))));

  /** Where one property control's dividers fall: a new group starts a divider. */
  function startsGroup(list: ToolbarControl[], index: number): boolean {
    return index > 0 && list[index - 1].group !== list[index].group;
  }

  function more(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    onMore({ x: rect.left, y: rect.top }, split.overflow);
  }
</script>

<div class="toolbar" role="toolbar" aria-label={t('toolbar.label')}>
  {#if colours}
    <StyleBar fill={styles.fill} stroke={styles.stroke} color={styles.color} {onApply} />
  {/if}

  {#each split.shown as control, index (control.id)}
    {#if index === 0 || startsGroup(split.shown, index)}
      <span class="divider" aria-hidden="true"></span>
    {/if}
    {#if control.kind === 'slider'}
      <OpacityPicker
        current={(properties.opacity ?? null) as number | null | 'mixed'}
        onSelect={(value) => onProperty('opacity', value)}
      />
    {:else}
      {@const option = PROPERTY_OPTIONS[control.id as PropertyKey]}
      <OptionPicker
        label={t(option.labelKey)}
        icon={option.icon}
        options={option.options}
        current={(properties[control.id as PropertyKey] ?? null) as PropertyValue | null | 'mixed'}
        onSelect={(value) => onProperty(control.id as PropertyKey, value)}
      />
    {/if}
  {/each}

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
