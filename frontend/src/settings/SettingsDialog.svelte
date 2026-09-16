<script lang="ts">
  /**
   * Settings. Later milestones add sections — Files, AI Providers, Updates,
   * Keyboard, About — each with the milestone that owns it. Appearance is
   * first because the theme layer already exists.
   */
  import Dialog from '../components/Dialog.svelte';
  import { t } from '../i18n/t';
  import type { ThemeChoice } from '../styles/theme.svelte';

  type Props = {
    open: boolean;
    choice: ThemeChoice;
    onChoose: (choice: ThemeChoice) => void;
    onOpenChange: (open: boolean) => void;
  };

  let { open = $bindable(), choice, onChoose, onOpenChange }: Props = $props();

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
      <div class="choices" role="radiogroup" aria-label={t('settings.theme')}>
        {#each themes as option (option.value)}
          <button
            type="button"
            role="radio"
            aria-checked={choice === option.value}
            class="choice"
            class:selected={choice === option.value}
            onclick={() => onChoose(option.value)}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  </section>
</Dialog>

<style>
  .section {
    min-width: 0;
  }

  .heading {
    margin: 0 0 var(--space-3);
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    letter-spacing: 0.06em;
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

  .choices {
    display: inline-flex;
    gap: var(--space-1);
    padding: var(--space-1);
    background: var(--color-surface-sunken);
    border-radius: var(--radius-md);
  }

  .choice {
    height: var(--size-row);
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    font: inherit;
    font-size: var(--text-control);
    color: var(--color-text-secondary);
  }

  .choice.selected {
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
  }

  .choice:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }
</style>
