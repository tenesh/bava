<script lang="ts">
  /**
   * The selection's colours: fill, border and text, each a swatch picker.
   *
   * Presentational. It shows what the selection currently uses and reports a
   * choice; the caller applies it as one undo step. Each picker wraps Ark's
   * Popover, and the swatches are Ark's RadioGroup, which gives arrow-key
   * navigation between them.
   */
  import { Popover, Portal, RadioGroup } from '@ark-ui/svelte';
  import Tooltip from './Tooltip.svelte';
  import { portalRoot } from './portal-root';
  import { SWATCHES, isSwatch } from '../canvas/palette';
  import type { StyleKey } from '../canvas/style';
  import { t } from '../i18n/t';

  type Current = string | null | 'mixed' | 'unavailable';

  type Props = {
    fill: Current;
    stroke: Current;
    color: Current;
    onApply: (key: StyleKey, swatch: string | null) => void;
  };

  let { fill, stroke, color, onApply }: Props = $props();

  const DEFAULT = 'default';

  const pickers = $derived(
    (
      [
        { key: 'fill', label: t('style.fill'), current: fill, part: 'fill' },
        { key: 'stroke', label: t('style.stroke'), current: stroke, part: 'stroke' },
        { key: 'color', label: t('style.color'), current: color, part: 'text' },
      ] as const
    ).filter((picker) => picker.current !== 'unavailable'),
  );

  const swatchName = (swatch: string) => t(`swatch.${swatch}` as 'swatch.blue');

  /** The chip shown on a trigger: the current swatch, the default, or mixed. */
  function chip(current: Current, part: string): string {
    if (current === 'mixed' || current === 'unavailable') return 'transparent';
    // An unknown name (from a newer Bava) draws as the default on the canvas;
    // the chip shows the same.
    return isSwatch(current) ? `var(--swatch-${current}-${part})` : `var(--color-shape-${part})`;
  }
</script>

<div class="bar" role="group" aria-label={t('style.toolbar')}>
  {#each pickers as picker (picker.key)}
    {@const triggerId = `bava-style-${picker.key}-trigger`}
    <!--
      One chip, two machines: the popover opens the swatches and the tooltip
      names it. Both are told the same trigger id, and the popover's props are
      merged into the tooltip's, so each finds the element and keeps its own
      attributes.
    -->
    <Popover.Root lazyMount unmountOnExit ids={{ trigger: triggerId }}>
      <Tooltip label={picker.label} placement="top" {triggerId}>
        {#snippet trigger(tipProps)}
          {#snippet chipButton(popoverProps: typeof tipProps)}
            <button {...tipProps(popoverProps())} class="bava-style-trigger" aria-label={picker.label}>
              <span
                class="chip"
                class:mixed={picker.current === 'mixed'}
                style:background={chip(picker.current, picker.part)}
              ></span>
            </button>
          {/snippet}
          <Popover.Trigger asChild={chipButton} />
        {/snippet}
      </Tooltip>
      <Portal container={portalRoot()}>
        <Popover.Positioner>
          <Popover.Content class="bava-style-popover">
            <RadioGroup.Root
              class="bava-swatches"
              value={picker.current === 'mixed' ? null : isSwatch(picker.current) ? picker.current : DEFAULT}
              onValueChange={(details) =>
                details.value && onApply(picker.key, details.value === DEFAULT ? null : details.value)}
              aria-label={picker.label}
            >
              {#each [DEFAULT, ...SWATCHES] as swatch (swatch)}
                <RadioGroup.Item value={swatch} class="bava-swatch">
                  <RadioGroup.ItemControl
                    class="bava-swatch-control"
                    style={`background: ${swatch === DEFAULT ? `var(--color-shape-${picker.part})` : `var(--swatch-${swatch}-${picker.part})`}`}
                  />
                  <RadioGroup.ItemText class="bava-swatch-name">{swatch === DEFAULT ? t('swatch.default') : swatchName(swatch)}</RadioGroup.ItemText>
                  <RadioGroup.ItemHiddenInput />
                </RadioGroup.Item>
              {/each}
            </RadioGroup.Root>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  {/each}
</div>

<style>
  /* A group inside the selection toolbar, which draws the surface. */
  .bar {
    display: inline-flex;
    gap: var(--space-1);
  }

  /* The chip is the control: a square button showing the swatch. */
  :global(.bava-style-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--size-row);
    height: var(--size-row);
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    font: inherit;
    font-size: var(--text-meta);
    color: var(--color-text-secondary);
  }

  :global(.bava-style-trigger:focus-visible),
  :global(.bava-swatch[data-focus-visible]) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .chip {
    width: var(--space-3);
    height: var(--space-3);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
  }

  .chip.mixed {
    background: repeating-linear-gradient(45deg, var(--color-border-strong) 0 var(--border-width), transparent 0 var(--space-1));
  }

  :global(.bava-style-popover) {
    z-index: var(--z-portal);
    padding: var(--space-2);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-floating);
  }

  :global(.bava-swatches) {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: var(--space-1);
  }

  :global(.bava-swatch) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    cursor: default;
  }

  :global(.bava-swatch[data-state='checked']) {
    background: var(--color-accent-subtle);
  }

  :global(.bava-swatch-control) {
    width: var(--space-4);
    height: var(--space-4);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
  }

  :global(.bava-swatch-name) {
    font-size: var(--text-meta);
    color: var(--color-text-primary);
  }
</style>
