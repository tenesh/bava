<script lang="ts">
  /**
   * New Space: a name for the Space's folder, and the place to make it.
   *
   * Presentational: the caller shows the folder picker when asked, and makes
   * the folder with the name typed.
   */
  import Dialog from './Dialog.svelte';
  import { t } from '../i18n/t';

  type Props = {
    open: boolean;
    /** The folder the new one is made in; '' until one is chosen. */
    location: string;
    onChooseLocation: () => void;
    onCreate: (name: string) => void;
    onOpenChange: (open: boolean) => void;
  };

  let { open = $bindable(), location, onChooseLocation, onCreate, onOpenChange }: Props = $props();

  let typed = $state('');
  $effect(() => {
    if (open) typed = '';
  });

  const ready = $derived(typed.trim() !== '' && location !== '');

  function create(event: SubmitEvent) {
    event.preventDefault();
    if (ready) onCreate(typed.trim());
  }
</script>

<Dialog bind:open title={t('space.newTitle')} size="narrow" closable {onOpenChange}>
  <form id="new-space-form" class="form" onsubmit={create}>
    <div class="section">
      <label class="heading" for="new-space-name">{t('space.newName')}</label>
      <input id="new-space-name" class="field" bind:value={typed} autocomplete="off" data-autofocus />
    </div>
    <div class="section">
      <span class="heading">{t('space.newLocation')}</span>
      <div class="row">
        <span class="path" class:empty={!location}>{location || t('space.newNoLocation')}</span>
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

  .path.empty {
    font-family: var(--font-ui);
    font-size: var(--text-control);
    color: var(--color-text-muted);
  }

  .hint {
    margin: 0;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
