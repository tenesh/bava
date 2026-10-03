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
  import { createPressModality } from './press-modality.svelte';
  import { SWATCHES, isLiteralColour, isSwatch } from '../canvas/palette';
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

  const modality = createPressModality();

  const DEFAULT = 'default';
  // Ids unique to this bar: a second bar on the page must not share them.
  const uid = $props.id();

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

  /** The swatch checked in a picker: none for mixed or a colour of the user's own. */
  function checked(current: Current): string | null {
    if (current === 'mixed' || current === 'unavailable' || isLiteralColour(current)) return null;
    return isSwatch(current) ? current : DEFAULT;
  }

  /**
   * The chip shown on a trigger: the current swatch or the default. Mixed
   * gives nothing, leaving the chip's hatch to show.
   */
  function chip(current: Current, part: string): string | undefined {
    if (current === 'mixed' || current === 'unavailable') return undefined;
    // A colour the user picked is shown as picked.
    if (isLiteralColour(current)) return current;
    // An unknown name (from a newer Bava) draws as the default on the canvas;
    // the chip shows the same.
    return isSwatch(current) ? `var(--swatch-${current}-${part})` : `var(--color-shape-${part})`;
  }
</script>

<div class="bar" role="group" aria-label={t('style.toolbar')}>
  {#each pickers as picker (picker.key)}
    {@const triggerId = `bava-style-${picker.key}-trigger-${uid}`}
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
            {@const ring = picker.part === 'stroke' && picker.current !== 'mixed'}
            <button {...tipProps(popoverProps())} class="bava-style-trigger" aria-label={picker.label}>
              <!-- A border colour is shown as a ring in it, with a clear middle. -->
              <span
                class="chip"
                class:mixed={picker.current === 'mixed'}
                class:ring
                style:background={ring ? 'transparent' : chip(picker.current, picker.part)}
                style:border-color={ring ? chip(picker.current, picker.part) : undefined}
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
              data-pointer={modality.byPointer ? '' : undefined}
              onpointerdown={modality.onpointerdown}
              onkeydown={modality.onkeydown}
              value={checked(picker.current)}
              onValueChange={(details) =>
                details.value && onApply(picker.key, details.value === DEFAULT ? null : details.value)}
              aria-label={picker.label}
            >
              {#each [DEFAULT, ...SWATCHES] as swatch (swatch)}
                {@const name = swatch === DEFAULT ? t('swatch.default') : swatchName(swatch)}
                <RadioGroup.Item value={swatch} class="bava-swatch" title={name}>
                  <RadioGroup.ItemControl
                    class="bava-swatch-control"
                    style={`background: ${swatch === DEFAULT ? `var(--color-shape-${picker.part})` : `var(--swatch-${swatch}-${picker.part})`}`}
                  />
                  <!-- Named for assistive technology and in the tooltip, not on screen. -->
                  <RadioGroup.ItemText class="bava-swatch-name">{name}</RadioGroup.ItemText>
                  <RadioGroup.ItemHiddenInput />
                </RadioGroup.Item>
              {/each}
            </RadioGroup.Root>

            <!-- A colour of the user's own, stored as picked. -->
            <label class="bava-custom">
              <span class="bava-custom-label">{t('style.custom')}</span>
              <input
                type="text"
                value={isLiteralColour(picker.current) ? picker.current : ''}
                placeholder={t('style.customHint')}
                spellcheck="false"
                autocomplete="off"
                onchange={(event) => {
                  const typed = event.currentTarget.value.trim();
                  if (isLiteralColour(typed)) onApply(picker.key, typed);
                  else event.currentTarget.value = isLiteralColour(picker.current) ? picker.current : '';
                }}
              />
            </label>
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
    width: var(--size-row-lg);
    height: var(--size-row-lg);
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    font: inherit;
    font-size: var(--text-meta);
    color: var(--color-text-secondary);
  }

  :global(.bava-style-trigger:hover:not(:disabled)) {
    background: var(--color-control-hover);
    color: var(--color-text-primary);
  }

  :global(.bava-style-trigger:active:not(:disabled)) {
    background: var(--color-control-active);
  }

  :global(.bava-style-trigger:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  /* Keyboard focus only: Ark marks a press as focus-visible too, so not
     after a press (`press-modality.svelte.ts`). */
  :global(.bava-swatches:not([data-pointer]) .bava-swatch[data-focus-visible] .bava-swatch-control) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }

  .chip {
    box-sizing: border-box;
    width: var(--space-4);
    height: var(--space-4);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
  }

  .chip.ring {
    border-width: var(--size-chip-ring);
  }

  .chip.mixed {
    background: repeating-linear-gradient(45deg, var(--color-border-strong) 0 var(--border-width), transparent 0 var(--space-1));
  }

  :global(.bava-style-popover) {
    z-index: var(--z-portal);
    padding: var(--size-picker-padding);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-floating);
  }

  :global(.bava-swatches) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-swatch-gap);
  }

  :global(.bava-custom) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: var(--border-width) solid var(--color-border-subtle);
    font-size: var(--text-meta);
    color: var(--color-text-secondary);
  }

  :global(.bava-custom input) {
    width: var(--size-field-number);
    height: var(--size-row);
    padding: 0 var(--space-2);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    font-family: var(--font-mono);
    font-size: var(--text-mono-chip);
    color: var(--color-text-primary);
  }

  :global(.bava-custom input:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
  }

  :global(.bava-swatch) {
    position: relative;
    display: flex;
    cursor: default;
  }

  :global(.bava-swatch-control) {
    box-sizing: border-box;
    width: var(--size-row-sm);
    height: var(--size-row-sm);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
  }

  :global(.bava-swatch[data-state='checked'] .bava-swatch-control) {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 var(--focus-halo-width) var(--color-selection);
  }

  /* Hidden from sight, still the radio's accessible name. */
  :global(.bava-swatch-name) {
    position: absolute;
    width: var(--border-width);
    height: var(--border-width);
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
