<script lang="ts">
  /**
   * Space settings: the Space's name (renaming its folder), its
   * default page width, and Show in Finder.
   *
   * Edits are held here until Save, which applies only what changed; Cancel,
   * the close button and Escape drop them.
   *
   * Presentational: the caller renames, saves the width and reveals.
   */
  import Dialog from './Dialog.svelte';
  import Segments from './Segments.svelte';
  import { untrack } from 'svelte';
  import { t } from '../i18n/t';

  type Width = '' | 'narrow' | 'wide' | 'full';

  type Props = {
    open: boolean;
    name: string;
    root: string;
    pageWidth: Width;
    onRename: (name: string) => void;
    onPageWidth: (width: Width) => void;
    onReveal: () => void;
    onOpenChange: (open: boolean) => void;
  };

  let { open = $bindable(), name, root, pageWidth, onRename, onPageWidth, onReveal, onOpenChange }: Props = $props();

  let typed = $state('');
  let width = $state<Width>('');
  // Taken afresh each time the dialog opens, and not again while it is open:
  // a save that lands mid-edit must not overwrite what is being typed.
  $effect(() => {
    if (!open) return;
    untrack(() => {
      typed = name;
      width = pageWidth;
    });
  });

  // Segments need a value for "none": the app's own setting.
  const widths: { value: string; label: string }[] = [
    { value: 'app', label: t('width.app') },
    { value: 'narrow', label: t('width.narrow') },
    { value: 'wide', label: t('width.wide') },
    { value: 'full', label: t('width.full') },
  ];

  function save(event: SubmitEvent) {
    event.preventDefault();
    const next = typed.trim();
    if (next && next !== name) onRename(next);
    if (width !== pageWidth) onPageWidth(width);
    onOpenChange(false);
  }
</script>

<Dialog bind:open title={t('space.settings.title')} size="narrow" closable {onOpenChange}>
  <form id="space-settings-form" class="sections" onsubmit={save}>
    <div class="section">
      <label class="heading" for="space-name">{t('space.settings.name')}</label>
      <input id="space-name" class="field" bind:value={typed} autocomplete="off" />
      <p class="hint">{t('space.settings.renameHint')}</p>
    </div>
    <div class="section">
      <span class="heading">{t('space.settings.width')}</span>
      <div>
        <Segments
          value={width || 'app'}
          options={widths}
          label={t('space.settings.width')}
          onValueChange={(value) => (width = value === 'app' ? '' : (value as Width))}
        />
      </div>
      <p class="hint">{t('space.settings.widthHint')}</p>
    </div>
    <div class="section">
      <span class="heading">{t('space.settings.folder')}</span>
      <div class="row">
        <span class="path">{root}</span>
        <button type="button" class="button" onclick={onReveal}>{t('space.reveal')}</button>
      </div>
    </div>
  </form>
  {#snippet footer()}
    <button type="button" class="button" onclick={() => onOpenChange(false)}>{t('file.cancel')}</button>
    <button type="submit" form="space-settings-form" class="button primary" disabled={!typed.trim()}>
      {t('space.settings.save')}
    </button>
  {/snippet}
</Dialog>

<style>
  .sections {
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
    border-color: var(--color-accent);
    box-shadow: 0 0 0 var(--focus-halo-width) var(--color-accent-subtle);
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

  .button {
    height: var(--size-row-lg);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-control);
  }

  .button.primary {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-accent-contrast);
  }

  .button:disabled {
    opacity: var(--opacity-disabled);
  }

  .button:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }

  .hint {
    margin: 0;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
