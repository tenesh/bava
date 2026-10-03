<script lang="ts">
  /**
   * An on/off setting, wrapping Ark's Switch.
   *
   * Ark supplies the checkbox semantics, the hidden input and the keyboard
   * behaviour; a styled div with a click handler has none of them.
   * Presentational: it shows the state it is given and reports a change.
   */
  // Class names are prefixed because Ark renders its own elements, so Svelte's
  // scoping cannot reach them and these rules have to be global.
  import { Switch } from '@ark-ui/svelte';

  type Props = {
    label: string;
    checked: boolean;
    /** Shown but inert, so the setting still explains itself. */
    disabled?: boolean;
    /**
     * `inline` puts the switch before its label; `row` fills its width with
     * the label first and the switch at the end, as a list of settings reads.
     */
    variant?: 'inline' | 'row';
    onChange: (checked: boolean) => void;
  };

  let { label, checked, disabled = false, variant = 'inline', onChange }: Props = $props();
</script>

<Switch.Root
  {checked}
  {disabled}
  class="bava-toggle"
  data-variant={variant}
  onCheckedChange={(details) => onChange(details.checked)}
>
  {#if variant === 'row'}
    <Switch.Label class="bava-toggle-label">{label}</Switch.Label>
  {/if}
  <Switch.Control class="bava-toggle-track">
    <Switch.Thumb class="bava-toggle-thumb" />
  </Switch.Control>
  {#if variant === 'inline'}
    <Switch.Label class="bava-toggle-label">{label}</Switch.Label>
  {/if}
  <Switch.HiddenInput />
</Switch.Root>

<style>
  :global(.bava-toggle) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-control);
    color: var(--color-text-primary);
    cursor: default;
  }

  :global(.bava-toggle[data-variant='row']) {
    justify-content: space-between;
    gap: var(--space-4);
    min-height: var(--size-row-xl);
    color: var(--color-text-secondary);
  }

  :global(.bava-toggle[data-disabled]) {
    color: var(--color-text-muted);
  }

  :global(.bava-toggle-track) {
    position: relative;
    display: flex;
    align-items: center;
    width: var(--size-toggle-track);
    flex: none;
    height: var(--size-toggle-thumb);
    padding: var(--space-half);
    box-sizing: border-box;
    border-radius: var(--radius-full);
    background: var(--color-border-strong);
    transition: background var(--duration-fast) var(--ease-out);
  }

  :global(.bava-toggle-track[data-state='checked']) {
    background: var(--color-accent);
  }

  /* A wash of ink over the off track, a step darker on the on one. */
  :global(.bava-toggle-track[data-hover]:not([data-disabled])) {
    background: linear-gradient(var(--color-control-active), var(--color-control-active)), var(--color-border-strong);
  }

  :global(.bava-toggle-track[data-state='checked'][data-hover]:not([data-disabled])) {
    background: var(--color-accent-hover);
  }

  /* Disabled reads as disabled whether it is on or off. */
  :global(.bava-toggle-track[data-disabled]) {
    opacity: var(--opacity-disabled);
  }

  /* The hidden input takes focus, a sibling of the track, so the ring is
     reached through the root. The browser's own :focus-visible, not Ark's
     attribute: Ark also sets that when a press on the label clicks the input. */
  :global(.bava-toggle:has(input:focus-visible) .bava-toggle-track) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }

  :global(.bava-toggle-thumb) {
    width: var(--size-toggle-dot);
    height: var(--size-toggle-dot);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    transition: translate var(--duration-fast) var(--ease-out);
  }

  :global(.bava-toggle-thumb[data-state='checked']) {
    translate: calc(var(--size-toggle-track) - var(--size-toggle-dot) - var(--space-half) * 2) 0;
  }
</style>
