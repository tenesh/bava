<script lang="ts">
  /**
   * Above a page opened on its own whose pictures and files Bava may not
   * reach yet: what it needs, and Allow access, which asks the system's
   * folder dialog for it.
   *
   * Presentational: it reports Allow access.
   */
  import ToolIcon from './ToolIcon.svelte';
  import { t } from '../i18n/t';

  type Props = {
    /** The folder's name, as the user knows it. */
    folder: string;
    onAllow: () => void;
  };

  let { folder, onAllow }: Props = $props();
</script>

<div class="access-bar" role="region" aria-label={t('access.bar')}>
  <ToolIcon id="folder" size="sm" />
  <span class="what">{t('access.needed').replace('{folder}', folder)}</span>
  <button type="button" class="bava-button allow" onclick={onAllow}>{t('access.allow')}</button>
</div>

<style>
  .access-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
    background: var(--color-surface-sunken);
    color: var(--color-text-secondary);
    font-size: var(--text-meta);
  }

  .what {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
