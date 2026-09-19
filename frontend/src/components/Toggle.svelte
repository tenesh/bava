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
    onChange: (checked: boolean) => void;
  };

  let { label, checked, disabled = false, onChange }: Props = $props();
</script>

<Switch.Root
  {checked}
  {disabled}
  class="bava-toggle"
  onCheckedChange={(details) => onChange(details.checked)}
>
  <Switch.Control class="bava-toggle-track">
    <Switch.Thumb class="bava-toggle-thumb" />
  </Switch.Control>
  <Switch.Label class="bava-toggle-label">{label}</Switch.Label>
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

  :global(.bava-toggle[data-disabled]) {
    color: var(--color-text-muted);
  }

  :global(.bava-toggle-track) {
    position: relative;
    display: flex;
    align-items: center;
    width: var(--size-toggle-track);
    height: var(--size-toggle-thumb);
    padding: var(--border-width);
    border-radius: var(--radius-full);
    background: var(--color-border-subtle);
    transition: background var(--motion-fast) var(--easing-standard);
  }

  :global(.bava-toggle-track[data-state='checked']) {
    background: var(--color-accent);
  }

  :global(.bava-toggle-track:has(:focus-visible)) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }

  :global(.bava-toggle-thumb) {
    width: var(--size-toggle-dot);
    height: var(--size-toggle-dot);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    transition: translate var(--motion-fast) var(--easing-standard);
  }

  :global(.bava-toggle-thumb[data-state='checked']) {
    translate: calc(var(--size-toggle-track) - var(--size-toggle-dot) - var(--border-width) * 2) 0;
  }
</style>
