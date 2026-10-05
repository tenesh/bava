<script lang="ts">
  /**
   * A question with a fixed set of answers, and optionally one switch that
   * changes what the answer does (off until turned on), with its warning.
   *
   * Presentational: it shows the options and reports the one chosen. What the
   * question means, and what happens next, belongs to the caller.
   */
  import Dialog from './Dialog.svelte';
  import Toggle from './Toggle.svelte';

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
    /** A switch shown under the question, off at first; `hint` says what turning it on costs. */
    check?: { label: string; hint?: string };
    /** The answer, with whether the switch was on. */
    onChoose: (value: string, checked: boolean) => void;
  };

  let { open = $bindable(), title, body, options, check, onChoose }: Props = $props();

  let checked = $state(false);
</script>

<Dialog
  bind:open
  {title}
  variant="alert"
  onOpenChange={(next) => {
    // Dismissing (escape, a backdrop click) is a cancel, never an accident.
    if (!next) onChoose('cancel', false);
  }}
>
  <p class="body">{body}</p>
  {#if check}
    <div class="check">
      <Toggle label={check.label} {checked} onChange={(next) => (checked = next)} />
      {#if check.hint}<p class="hint">{check.hint}</p>{/if}
    </div>
  {/if}
  <div class="options">
    {#each options as option (option.value)}
      <button
        type="button"
        class="bava-button"
        class:primary={option.primary}
        onclick={() => onChoose(option.value, check !== undefined && checked)}
      >
        {option.label}
      </button>
    {/each}
  </div>
</Dialog>

<style>
  .check {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    max-width: 44ch;
  }

  .hint {
    margin: 0;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

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
