<script lang="ts">
  /**
   * A question with a fixed set of answers.
   *
   * Presentational: it shows the options and reports the one chosen. What the
   * question means, and what happens next, belongs to the caller.
   */
  import Dialog from './Dialog.svelte';

  type Option = {
    value: string;
    label: string;
    /** The action a user should reach for; drawn with the accent. */
    primary?: boolean;
  };

  type Props = {
    open: boolean;
    title: string;
    body: string;
    options: Option[];
    onChoose: (value: string) => void;
  };

  let { open = $bindable(), title, body, options, onChoose }: Props = $props();
</script>

<Dialog
  bind:open
  {title}
  onOpenChange={(next) => {
    // Dismissing — escape, a backdrop click — is a cancel, never an accident.
    if (!next) onChoose('cancel');
  }}
>
  <p class="body">{body}</p>
  <div class="options">
    {#each options as option (option.value)}
      <button
        type="button"
        class="option"
        class:primary={option.primary}
        onclick={() => onChoose(option.value)}
      >
        {option.label}
      </button>
    {/each}
  </div>
</Dialog>

<style>
  .body {
    margin: 0 0 var(--space-4);
    font-size: var(--text-control);
    color: var(--color-text-secondary);
    max-width: 44ch;
  }

  .options {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .option {
    height: var(--size-row-lg);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    font: inherit;
    font-size: var(--text-control);
    color: var(--color-text-primary);
  }

  .option.primary {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-accent-contrast);
  }

  .option:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }
</style>
