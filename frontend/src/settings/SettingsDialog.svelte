<script lang="ts">
  /**
   * Settings: a full-height section list on the left, one section shown at a
   * time beside it under a header naming it. Appearance lives here; the
   * others (Files, Canvas, Advanced) are owned elsewhere and handed in.
   *
   * The layout is composed inside the dialog's body: the frame's own header
   * stays in the DOM, visually hidden, so the dialog is still named by its
   * title.
   */
  import Dialog from '../components/Dialog.svelte';
  import Segments from '../components/Segments.svelte';
  import SectionTabs, { type Section } from '../components/SectionTabs.svelte';
  import ToolIcon from '../components/ToolIcon.svelte';
  import { t } from '../i18n/t';
  import type { ThemeChoice } from '../styles/theme.svelte';

  type Props = {
    open: boolean;
    choice: ThemeChoice;
    onChoose: (choice: ThemeChoice) => void;
    onOpenChange: (open: boolean) => void;
    /** Sections owned elsewhere, after Appearance. */
    sections?: Section[];
  };

  let { open = $bindable(), choice, onChoose, onOpenChange, sections = [] }: Props = $props();

  const themes: { value: ThemeChoice; label: string }[] = [
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
    { value: 'system', label: t('settings.theme.system') },
  ];

  function close() {
    open = false;
    onOpenChange(false);
  }
</script>

{#snippet appearance()}
  <section class="section">
    <h3 class="heading">{t('settings.appearance.group')}</h3>
    <div class="row">
      <span class="label">{t('settings.theme')}</span>
      <Segments value={choice} options={themes} label={t('settings.theme')} onValueChange={onChoose} />
    </div>
  </section>
{/snippet}

{#snippet closeButton()}
  <button type="button" class="bava-icon-button" aria-label={t('dialog.close')} onclick={close}>
    <ToolIcon id="close" size="sm" />
  </button>
{/snippet}

<Dialog bind:open title={t('settings.title')} size="settings" flush headless {onOpenChange}>
  <div class="bava-settings">
    <SectionTabs
      label={t('settings.title')}
      heading={t('settings.title')}
      end={closeButton}
      sections={[
        { value: 'appearance', label: t('settings.appearance'), icon: 'appearance', content: appearance },
        ...sections,
      ]}
    />
  </div>
</Dialog>

<style>
  .bava-settings {
    height: 100%;
  }

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
