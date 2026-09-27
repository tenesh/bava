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
  variant="alert"
  onOpenChange={(next) => {
    // Dismissing (escape, a backdrop click) is a cancel, never an accident.
    if (!next) onChoose('cancel');
  }}
>
  <p class="body">{body}</p>
  <div class="options">
    {#each options as option (option.value)}
      <button
        type="button"
        class="bava-button"
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
    margin: 0;
    max-width: 44ch;
    font-size: var(--text-body);
    color: var(--color-text-secondary);
  }

  .options {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
