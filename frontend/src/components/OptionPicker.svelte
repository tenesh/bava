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
  import { tick } from 'svelte';
  import { portalRoot } from './portal-root';
  import { createPressModality } from './press-modality.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import Tooltip from './Tooltip.svelte';
  import type { IconId } from './tool-icons';
  import type { MessageKey } from '../i18n/messages';
  import { t } from '../i18n/t';

  type Props = {
    label: string;
    /** The icon on the button: the property, or its current value. */
    icon: IconId;
    /** `more`: shown only once More is pressed, or when it is the current value. */
    options: readonly ({ value: Value; icon: IconId; more?: boolean } & (
      | { labelKey: MessageKey; label?: never }
      | { label: string; labelKey?: never }
    ))[];
    /** The selection's value, `mixed` where they differ. */
    current: Value | null | 'mixed';
    onSelect: (value: Value) => void;
  };

  let { label, icon, options, current, onSelect }: Props = $props();

  const modality = createPressModality();

  // Unique to this picker: two pickers with one label must not share it.
  const uid = $props.id();
  const triggerId = $derived(`bava-option-${label.toLowerCase().replace(/[^a-z]+/g, '-')}-${uid}`);
  const checked = $derived(current === 'mixed' || current === null ? null : String(current));
  let expanded = $state(false);
  const hasMore = $derived(options.some((option) => option.more));
  const currentIsMore = $derived(options.some((option) => option.more && option.value === current));
  const shown = $derived(expanded || currentIsMore ? options : options.filter((option) => !option.more));
  let list = $state<HTMLElement | null>(null);

  /** Reveal the rest, and put the keyboard on the first of them: More itself goes. */
  async function showMore() {
    expanded = true;
    await tick();
    const first = options.find((option) => option.more);
    const input = first ? list?.querySelector<HTMLInputElement>(`input[value="${String(first.value)}"]`) : null;
    input?.focus();
  }

  /** A translated name, or a proper noun the option carries itself. */
  const nameOf = (option: { labelKey?: MessageKey; label?: string }) =>
    option.labelKey ? t(option.labelKey) : (option.label ?? '');
</script>

<Popover.Root
  lazyMount
  unmountOnExit
  ids={{ trigger: triggerId }}
  onOpenChange={(details) => {
    // Each opening starts short again.
    if (!details.open) expanded = false;
  }}
>
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
      <Popover.Content class="bava-control-popover" bind:ref={list}>
        <RadioGroup.Root
          class="bava-options"
          data-pointer={modality.byPointer ? '' : undefined}
          onpointerdown={modality.onpointerdown}
          onkeydown={modality.onkeydown}
          value={checked}
          onValueChange={(details) => {
            const chosen = options.find((option) => String(option.value) === details.value);
            if (chosen) onSelect(chosen.value);
          }}
          aria-label={label}
        >
          {#each shown as option (option.value)}
            <RadioGroup.Item value={String(option.value)} class="bava-option" title={nameOf(option)}>
              <RadioGroup.ItemControl class="bava-option-control">
                <ToolIcon id={option.icon} size="sm" />
              </RadioGroup.ItemControl>
              <RadioGroup.ItemText class="bava-option-name">{nameOf(option)}</RadioGroup.ItemText>
              <RadioGroup.ItemHiddenInput />
            </RadioGroup.Item>
          {/each}
        </RadioGroup.Root>
        {#if hasMore && shown.length < options.length}
          <button type="button" class="bava-options-more" onclick={showMore}>{t('option.more')}</button>
        {/if}
      </Popover.Content>
    </Popover.Positioner>
  </Portal>
</Popover.Root>

<style>
  :global(.bava-options) {
    display: flex;
    flex-direction: column;
    gap: var(--space-half);
  }

  :global(.bava-option) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--size-row-lg);
    padding: 0 var(--space-2);
    border-radius: var(--radius-md);
    font-size: var(--text-control);
    color: var(--color-text-primary);
    cursor: default;
  }

  :global(.bava-option[data-state='checked']) {
    background: var(--color-selection);
    color: var(--color-text-primary);
  }

  /* Keyboard focus only: Ark marks a press as focus-visible too, so not
     after a press (`press-modality.svelte.ts`). */
  :global(.bava-options:not([data-pointer]) .bava-option[data-focus-visible]) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  /* The row that reveals the rest of a long list (the crow's-foot heads). */
  .bava-options-more {
    width: 100%;
    height: var(--size-row-lg);
    margin-top: var(--space-half);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    font: inherit;
    font-size: var(--text-control);
    color: var(--color-text-secondary);
    text-align: left;
  }

  .bava-options-more:hover:not(:disabled) {
    background: var(--color-surface-sunken);
  }

  .bava-options-more:active:not(:disabled) {
    background: linear-gradient(var(--color-control-active), var(--color-control-active)), var(--color-surface-sunken);
  }

  .bava-options-more:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }
</style>
