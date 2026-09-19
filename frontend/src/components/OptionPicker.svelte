<script lang="ts" generics="Value extends string | number">
  /**
   * One property of the selection, chosen from a few icon options: stroke
   * width, line style, edges, text size, alignment, arrow type, arrowheads.
   *
   * A button that opens a small popover of choices, wrapping Ark's Popover and
   * RadioGroup, which gives the options arrow-key navigation. Presentational:
   * it shows the current value and reports a choice.
   */
  import { Popover, Portal, RadioGroup } from '@ark-ui/svelte';
  import { portalRoot } from './portal-root';
  import ToolIcon from './ToolIcon.svelte';
  import Tooltip from './Tooltip.svelte';
  import type { IconId } from './tool-icons';
  import type { MessageKey } from '../i18n/messages';
  import { t } from '../i18n/t';

  type Props = {
    label: string;
    /** The icon on the button: the property, or its current value. */
    icon: IconId;
    options: readonly ({ value: Value; icon: IconId } & (
      | { labelKey: MessageKey; label?: never }
      | { label: string; labelKey?: never }
    ))[];
    /** The selection's value, `mixed` where they differ. */
    current: Value | null | 'mixed';
    onSelect: (value: Value) => void;
  };

  let { label, icon, options, current, onSelect }: Props = $props();

  const triggerId = $derived(`bava-option-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`);
  const checked = $derived(current === 'mixed' || current === null ? null : String(current));

  /** A translated name, or a proper noun the option carries itself. */
  const nameOf = (option: { labelKey?: MessageKey; label?: string }) =>
    option.labelKey ? t(option.labelKey) : (option.label ?? '');
</script>

<Popover.Root lazyMount unmountOnExit ids={{ trigger: triggerId }}>
  <Tooltip {label} placement="top" {triggerId}>
    {#snippet trigger(tipProps)}
      {#snippet optionButton(popoverProps: typeof tipProps)}
        <button {...tipProps(popoverProps())} class="bava-control-trigger" aria-label={label}>
          <ToolIcon id={icon} />
        </button>
      {/snippet}
      <Popover.Trigger asChild={optionButton} />
    {/snippet}
  </Tooltip>
  <Portal container={portalRoot()}>
    <Popover.Positioner>
      <Popover.Content class="bava-control-popover">
        <RadioGroup.Root
          class="bava-options"
          value={checked}
          onValueChange={(details) => {
            const chosen = options.find((option) => String(option.value) === details.value);
            if (chosen) onSelect(chosen.value);
          }}
          aria-label={label}
        >
          {#each options as option (option.value)}
            <RadioGroup.Item value={String(option.value)} class="bava-option" title={nameOf(option)}>
              <RadioGroup.ItemControl class="bava-option-control">
                <ToolIcon id={option.icon} size="sm" />
              </RadioGroup.ItemControl>
              <RadioGroup.ItemText class="bava-option-name">{nameOf(option)}</RadioGroup.ItemText>
              <RadioGroup.ItemHiddenInput />
            </RadioGroup.Item>
          {/each}
        </RadioGroup.Root>
      </Popover.Content>
    </Popover.Positioner>
  </Portal>
</Popover.Root>

<style>



  :global(.bava-options) {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  :global(.bava-option) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--size-row);
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-meta);
    color: var(--color-text-primary);
    cursor: default;
  }

  :global(.bava-option[data-state='checked']) {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  :global(.bava-option[data-focus-visible]) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }
</style>
