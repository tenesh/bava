<script lang="ts">
  /**
   * New Space: a name for the Space's folder, and the place to make it.
   *
   * Presentational: the caller shows the folder picker when asked, and makes
   * the folder with the name typed. A name it refuses comes back as the
   * reason, shown under the field while the dialog stays open: the dialog is
   * modal, so a word anywhere else sits behind it.
   */
  import Dialog from './Dialog.svelte';
  import { t } from '../i18n/t';

  type Props = {
    open: boolean;
    /** The folder the new one is made in; '' until one is chosen. */
    location: string;
    onChooseLocation: () => void;
    /** Makes the Space; answers with the reason when the name is refused. */
    onCreate: (name: string) => Promise<string | null | undefined> | void;
    onOpenChange: (open: boolean) => void;
  };

  let { open = $bindable(), location, onChooseLocation, onCreate, onOpenChange }: Props = $props();

  let typed = $state('');
  let refusal = $state<string | null>(null);
  let field: HTMLInputElement | undefined = $state();
  $effect(() => {
    if (!open) return;
    typed = '';
    refusal = null;
  });

  const ready = $derived(typed.trim() !== '' && location !== '');

  async function create(event: SubmitEvent) {
    event.preventDefault();
    if (!ready) return;
    const reason = await onCreate(typed.trim());
    if (!reason) return;
    refusal = reason;
    field?.focus();
  }
</script>

<Dialog bind:open title={t('space.newTitle')} size="narrow" closable {onOpenChange}>
  <form id="new-space-form" class="form" onsubmit={create}>
    <div class="section">
      <label class="heading" for="new-space-name">{t('space.newName')}</label>
      <input
        id="new-space-name"
        class="field"
        bind:this={field}
        bind:value={typed}
        oninput={() => (refusal = null)}
        autocomplete="off"
        aria-invalid={refusal ? 'true' : undefined}
        aria-describedby={refusal ? 'new-space-refusal' : undefined}
        data-autofocus
      />
      {#if refusal}<p id="new-space-refusal" class="refusal" role="alert">{refusal}</p>{/if}
    </div>
    <div class="section">
      <span class="heading">{t('space.newLocation')}</span>
      <div class="row">
        <span class="path" class:empty={!location} title={location || undefined}>
          {#if location}<bdi>{location}</bdi>{:else}{t('space.newNoLocation')}{/if}
        </span>
        <button type="button" class="bava-button" onclick={onChooseLocation}>{t('space.newChoose')}</button>
      </div>
      <p class="hint">{t('space.newHint')}</p>
    </div>
  </form>
  {#snippet footer()}
    <button type="button" class="bava-button" onclick={() => onOpenChange(false)}>{t('file.cancel')}</button>
    <button type="submit" form="new-space-form" class="bava-button primary" disabled={!ready}>{t('space.newCreate')}</button>
  {/snippet}
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    margin: 0;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--size-field-gap);
  }

  .heading {
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    font-family: var(--font-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .field {
    height: var(--size-field);
    padding: 0 var(--size-field-padding);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-body);
  }

  .field:focus {
    outline: none;
    border-color: var(--color-focus-ring);
    box-shadow: 0 0 0 var(--focus-halo-width) var(--color-focus-halo);
  }

  /* After focus, so a refused name shows red while the keyboard is still in it. */
  .field[aria-invalid='true'] {
    border-color: var(--color-danger);
  }

  .path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: var(--text-meta);
    color: var(--color-text-secondary);
  }

  /*
   * A long path is cut at its start, so the folder's own name stays in
   * sight: right to left for the cut and the ellipsis, while the path itself,
   * isolated, still reads left to right.
   */
  .path:not(.empty) {
    direction: rtl;
    text-align: left;
  }

  .path.empty {
    font-family: var(--font-ui);
    font-size: var(--text-control);
    color: var(--color-text-muted);
  }

  .refusal {
    margin: 0;
    font-size: var(--text-meta);
    color: var(--color-danger);
  }

  .hint {
    margin: 0;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
