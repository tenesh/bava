<script lang="ts">
  /**
   * Above a template being edited: that it is a template, its group and
   * name, and Done to leave it.
   *
   * Presentational: it reports Done.
   */
  import ToolIcon from './ToolIcon.svelte';
  import { t } from '../i18n/t';

  type Props = {
    group: string;
    name: string;
    onDone: () => void;
  };

  let { group, name, onDone }: Props = $props();
</script>

<div class="template-bar" role="region" aria-label={t('templates.bar')}>
  <ToolIcon id="page" size="sm" />
  <span class="kind">{t('templates.bar')}</span>
  <span class="where">{group ? t('templates.place').replace('{group}', group).replace('{name}', name) : name}</span>
  <button type="button" class="bava-button primary done" onclick={onDone}>{t('templates.done')}</button>
</div>

<style>
  .template-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
    background: var(--color-accent-subtle);
    color: var(--color-text-secondary);
    font-size: var(--text-meta);
  }

  .kind {
    font-weight: var(--weight-semibold);
    color: var(--color-text-primary);
  }

  .where {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
