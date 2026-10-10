<script lang="ts" generics="T extends string">
  /**
   * A choice of one from a short list, as a dropdown: a trigger showing the
   * chosen option (after a `prefix`, when given) and a list to pick from.
   * Wraps Ark's Select, which supplies the listbox semantics, typeahead and
   * the keys: Enter, Space or the arrows open it, the arrows move, Enter
   * picks, Escape closes and gives focus back to the trigger.
   *
   * Presentational: it reports the value picked.
   */
  import { Portal, Select, createListCollection } from '@ark-ui/svelte';
  import { portalRoot } from './portal-root';
  import ToolIcon from './ToolIcon.svelte';

  type Props = {
    /** Its name for a screen reader. */
    label: string;
    value: T;
    options: { value: T; label: string }[];
    /** Shown before the chosen option: "Sort:". */
    prefix?: string;
    onValueChange: (value: T) => void;
  };

  let { label, value, options, prefix, onValueChange }: Props = $props();

  const collection = $derived(createListCollection({ items: options }));
  const chosen = $derived(options.find((option) => option.value === value)?.label ?? '');
</script>

<!--
  The list is mounted only while open: a modal dialog marks everything
  outside it hidden from screen readers when it opens, and a list mounted
  before then would stay hidden inside one.
-->
<Select.Root
  class="bava-select"
  data-name={label}
  lazyMount
  unmountOnExit
  {collection}
  value={[value]}
  positioning={{ placement: 'bottom-start', sameWidth: false }}
  onValueChange={(details) => {
    const next = details.value[0];
    if (next !== undefined && next !== value) onValueChange(next as T);
  }}
>
  <!-- Hidden from sight, it names the trigger, the list and the hidden select. -->
  <Select.Label class="bava-select-label">{label}</Select.Label>
  <Select.Control>
    <Select.Trigger class="bava-select-trigger">
      {#if prefix}<span class="bava-select-prefix">{prefix}</span>{/if}
      <span class="bava-select-value">{chosen}</span>
      <Select.Indicator class="bava-select-indicator"><ToolIcon id="chevronDown" size="sm" /></Select.Indicator>
    </Select.Trigger>
  </Select.Control>
  <Portal container={portalRoot()}>
    <Select.Positioner>
      <Select.Content class="bava-menu bava-select-content">
        {#each options as option (option.value)}
          <Select.Item item={option} class="bava-menu-item bava-select-item">
            <Select.ItemText class="bava-menu-label">{option.label}</Select.ItemText>
            <Select.ItemIndicator class="bava-select-check"><ToolIcon id="check" size="sm" /></Select.ItemIndicator>
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Positioner>
  </Portal>
  <Select.HiddenSelect />
</Select.Root>

<style>
  /* Global: Ark renders these elements itself, so scoping cannot reach them. */
  :global(.bava-select-trigger) {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--size-row-lg);
    padding: 0 var(--space-2) 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-control);
    white-space: nowrap;
    cursor: pointer;
  }

  :global(.bava-select-trigger:hover) {
    background: var(--color-control-hover);
  }

  :global(.bava-select-trigger:active),
  :global(.bava-select-trigger[data-state='open']) {
    background: var(--color-control-active);
  }

  :global(.bava-select-trigger:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }

  :global(.bava-select-label) {
    position: absolute;
    width: var(--border-width);
    height: var(--border-width);
    margin: calc(var(--border-width) * -1);
    padding: 0;
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  :global(.bava-select-prefix) {
    color: var(--color-text-muted);
  }

  :global(.bava-select-indicator) {
    display: inline-flex;
    color: var(--color-text-muted);
  }

  :global(.bava-select-check) {
    display: inline-flex;
    margin-inline-start: auto;
    color: var(--color-accent);
  }
</style>
