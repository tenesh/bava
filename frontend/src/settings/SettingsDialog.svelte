<script lang="ts">
  /**
   * Settings. Later milestones add sections (Files, AI Providers, Updates,
   * Keyboard, About), each with the milestone that owns it. Appearance is
   * first because the theme layer already exists.
   */
  import type { Snippet } from 'svelte';
  import Dialog from '../components/Dialog.svelte';
  import Segments from '../components/Segments.svelte';
  import { t } from '../i18n/t';
  import type { ThemeChoice } from '../styles/theme.svelte';

  type Props = {
    open: boolean;
    choice: ThemeChoice;
    onChoose: (choice: ThemeChoice) => void;
    onOpenChange: (open: boolean) => void;
    /** Sections owned elsewhere: Files, from the autosave settings. */
    sections?: Snippet;
  };

  let { open = $bindable(), choice, onChoose, onOpenChange, sections }: Props = $props();

  const themes: { value: ThemeChoice; label: string }[] = [
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
    { value: 'system', label: t('settings.theme.system') },
  ];
</script>

<Dialog bind:open title={t('settings.title')} {onOpenChange}>
  <section class="section">
    <h3 class="heading">{t('settings.appearance')}</h3>
    <div class="row">
      <span class="label">{t('settings.theme')}</span>
      <Segments value={choice} options={themes} label={t('settings.theme')} onValueChange={onChoose} />
    </div>
  </section>
  {#if sections}{@render sections()}{/if}
</Dialog>

<style>
  .section {
    min-width: 0;
  }

  .heading {
    margin: 0 0 var(--space-3);
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
    min-height: var(--size-row-lg);
  }

  .label {
    font-size: var(--text-control);
    color: var(--color-text-secondary);
  }

</style>
