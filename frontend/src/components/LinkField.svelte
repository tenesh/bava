<script lang="ts">
  /**
   * The link field over selected text: type an address and press Enter to
   * link it, Remove to unlink, Escape to leave it as it was. The same field
   * takes a medium's caption and its file's new name (`placeholder`,
   * `removeLabel`, or none to offer no Remove).
   *
   * Presentational: it reports what was typed; the Document acts on it.
   */
  import Portal from './Portal.svelte';
  import { pressAway } from './press-away';
  import { t } from '../i18n/t';

  type Props = {
    /**
     * The selection's top left on screen; the field sits above it, or on it
     * with `over`. With `over` and a `height`, the field alone, that tall,
     * sits on the line, its text where the line's is, and covers nothing more.
     */
    at: { left: number; top: number; height?: number };
    /** Sits the field's box on `at` itself, over what it edits (a caption, a file's name). */
    over?: boolean;
    /** The address the selection links to now, if any. */
    value: string;
    onApply: (href: string) => void;
    onRemove: () => void;
    onCancel: () => void;
    /** What the field asks for; a link's address by default. */
    placeholder?: string;
    /** The Remove button's words; null for no Remove. */
    removeLabel?: string | null;
    /**
     * What a press elsewhere does: by default it closes the field changing
     * nothing, as Escape does; `keepOnAway` keeps what was typed (a caption,
     * a file's name), as leaving a name field does.
     */
    keepOnAway?: boolean;
  };

  let { at, value, onApply, onRemove, onCancel, placeholder = t('link.placeholder'), removeLabel = t('link.remove'), keepOnAway = false, over = false }: Props = $props();
  /** Over a line of known height: the field alone, sized to it. */
  const line = $derived(over && at.height !== undefined);
  let form: HTMLFormElement | undefined = $state();

  // A press anywhere else closes it.
  $effect(() => pressAway(() => form, () => (keepOnAway ? onApply(href) : onCancel())));

  // Seeded once from the link the selection has; the field then owns it.
  // svelte-ignore state_referenced_locally
  let href = $state(value);
  // Focused once the portal has put it in the page, not before.
  let field: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (!field) return;
    field.focus();
    field.select();
  });
</script>

<Portal>
  <form
    bind:this={form}
    class="link-field"
    data-fit={line ? 'line' : undefined}
    style:left={line ? `calc(${at.left}px - var(--size-field-padding) - var(--border-width))` : over ? `calc(${at.left}px - var(--space-1) - var(--border-width))` : `${at.left}px`}
    style:top={line ? `${at.top}px` : over ? `calc(${at.top}px - var(--space-1) - var(--border-width))` : `calc(${at.top}px - var(--size-row-lg) - var(--space-3))`}
    onsubmit={(event) => {
      event.preventDefault();
      onApply(href);
    }}
  >
    <input
      bind:this={field}
      bind:value={href}
      class="bava-field"
      style:height={line ? `${at.height}px` : undefined}
      {placeholder}
      aria-label={placeholder}
      onkeydown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
        // Applied here as well as by the form: a key sent by a script submits nothing.
        if (event.key === 'Enter' && !event.isComposing) {
          event.preventDefault();
          onApply(href);
        }
      }}
    />
    {#if removeLabel}
      <button type="button" class="bava-button ghost" onclick={onRemove}>{removeLabel}</button>
    {/if}
  </form>
</Portal>

<style>
  .link-field {
    position: fixed;
    z-index: var(--z-portal);
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-floating);
  }

  /* Over a line: no frame, so nothing but the field covers what is round it. */
  .link-field[data-fit='line'] {
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none;
  }
</style>
