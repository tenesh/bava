<script lang="ts">
  /**
   * Save as template: the template's name (the page's to start with) and its
   * group, typed or one of the Space's groups picked; no group leaves it
   * outside any. A name the caller refuses comes back as `refusal`.
   *
   * Presentational: it reports the name and group.
   */
  import Dialog from './Dialog.svelte';
  import { t } from '../i18n/t';

  type Props = {
    open: boolean;
    /** The name it starts with. */
    name: string;
    /** The Space's groups, offered with a click. */
    groups: string[];
    /** Why the last name was refused; null when it was not. */
    refusal: string | null;
    onSave: (name: string, group: string) => void;
    onOpenChange: (open: boolean) => void;
    /** Its title: Save as template, or New template. */
    title?: string;
  };

  let { open, name, groups, refusal, onSave, onOpenChange, title = t('templates.saveTitle') }: Props = $props();

  // svelte-ignore state_referenced_locally
  let typed = $state(name);
  let group = $state('');

  const ready = $derived(typed.trim() !== '');

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (ready) onSave(typed.trim(), group.trim());
  }
</script>

<Dialog {open} {title} size="narrow" closable {onOpenChange}>
  <form id="save-template-form" class="form" onsubmit={save}>
    <div class="section">
      <label class="heading" for="template-name">{t('templates.name')}</label>
      <input
        id="template-name"
        class="field"
        bind:value={typed}
        autocomplete="off"
        aria-invalid={refusal ? 'true' : undefined}
        aria-describedby={refusal ? 'template-refusal' : undefined}
        data-autofocus
      />
      {#if refusal}<p id="template-refusal" class="refusal" role="alert">{refusal}</p>{/if}
    </div>
    <div class="section">
      <label class="heading" for="template-group">{t('templates.group')}</label>
      <input id="template-group" class="field" bind:value={group} autocomplete="off" placeholder={t('templates.noGroup')} />
      {#if groups.length > 0}
        <div class="groups" role="group" aria-label={t('templates.groups')}>
          {#each groups as each (each)}
            <button type="button" class="bava-button group" aria-pressed={group.trim() === each} onclick={() => (group = each)}>{each}</button>
          {/each}
        </div>
      {/if}
      <p class="hint">{t('templates.groupHint')}</p>
    </div>
  </form>
  {#snippet footer()}
    <button type="button" class="bava-button" onclick={() => onOpenChange(false)}>{t('file.cancel')}</button>
    <button type="submit" form="save-template-form" class="bava-button primary" disabled={!ready}>{t('templates.save')}</button>
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

  .field::placeholder {
    color: var(--color-text-muted);
  }

  .field:focus {
    outline: none;
    border-color: var(--color-focus-ring);
    box-shadow: 0 0 0 var(--focus-halo-width) var(--color-focus-halo);
  }

  .field[aria-invalid='true'] {
    border-color: var(--color-danger);
  }

  .groups {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .group[aria-pressed='true'] {
    background: var(--color-selection);
    border-color: var(--color-focus-ring);
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
