<script lang="ts">
  /**
   * The selection's opacity, on a slider in steps of ten, wrapping Ark's
   * Slider. Presentational: it shows the current value and reports a change.
   */
  import { Popover, Portal, Slider } from '@ark-ui/svelte';
  import { portalRoot } from './portal-root';
  import ToolIcon from './ToolIcon.svelte';
  import Tooltip from './Tooltip.svelte';
  import { t } from '../i18n/t';

  type Props = {
    /** The selection's opacity, `mixed` where they differ. */
    current: number | null | 'mixed';
    onSelect: (value: number) => void;
  };

  let { current, onSelect }: Props = $props();

  /** Ten steps, as Excalidraw's opacity slider has. */
  const STEP = 10;

  const label = t('style.opacity');
  const triggerId = 'bava-opacity-trigger';
  const value = $derived(typeof current === 'number' ? current : 100);
</script>

<Popover.Root lazyMount unmountOnExit ids={{ trigger: triggerId }}>
  <Tooltip {label} placement="top" {triggerId}>
    {#snippet trigger(tipProps)}
      {#snippet opacityButton(popoverProps: typeof tipProps)}
        <button {...tipProps(popoverProps())} class="bava-control-trigger" aria-label={label}>
          <ToolIcon id="opacity" />
        </button>
      {/snippet}
      <Popover.Trigger asChild={opacityButton} />
    {/snippet}
  </Tooltip>
  <Portal container={portalRoot()}>
    <Popover.Positioner>
      <Popover.Content class="bava-control-popover">
        <Slider.Root
          class="bava-slider"
          value={[value]}
          min={0}
          max={100}
          step={STEP}
          aria-label={[label]}
          onValueChange={(details) => onSelect(details.value[0])}
        >
          <Slider.Control class="bava-slider-control">
            <Slider.Track class="bava-slider-track">
              <Slider.Range class="bava-slider-range" />
            </Slider.Track>
            <Slider.Thumb index={0} class="bava-slider-thumb">
              <Slider.HiddenInput />
            </Slider.Thumb>
          </Slider.Control>
          <Slider.ValueText class="bava-slider-value" />
        </Slider.Root>
      </Popover.Content>
    </Popover.Positioner>
  </Portal>
</Popover.Root>

<style>
  :global(.bava-slider) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
  }

  :global(.bava-slider-control) {
    display: flex;
    align-items: center;
    width: var(--size-slider-track);
    height: var(--size-row);
  }

  :global(.bava-slider-track) {
    position: relative;
    width: 100%;
    height: var(--size-progress-thickness);
    border-radius: var(--radius-full);
    background: var(--color-border-subtle);
  }

  :global(.bava-slider-range) {
    height: 100%;
    border-radius: var(--radius-full);
    background: var(--color-accent);
  }

  :global(.bava-slider-thumb) {
    width: var(--size-slider-thumb);
    height: var(--size-slider-thumb);
    border: var(--border-width) solid var(--color-accent);
    border-radius: var(--radius-full);
    background: var(--color-surface);
  }

  :global(.bava-slider-thumb:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
  }

  :global(.bava-slider-value) {
    font-family: var(--font-mono);
    font-size: var(--text-mono-chip);
    color: var(--color-text-muted);
  }
</style>
