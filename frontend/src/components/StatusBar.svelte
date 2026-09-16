<script lang="ts">
  /**
   * Engine, node count, error count.
   *
   * Everything arrives as props: a component holds no IPC and no D2 knowledge,
   * so the shell reads the render result and hands the numbers down.
   */
  import { t } from '../i18n/t';

  type Props = {
    engine: string;
    nodes: number;
    errors: number;
  };

  let { engine, nodes, errors }: Props = $props();
</script>

<footer class="status">
  <span class="item">{t('status.engine')} <b>{engine}</b></span>
  <span class="item">{t('status.nodes')} <b>{nodes}</b></span>
  <span class="item" class:has-errors={errors > 0}>
    {t('status.errors')} <b>{errors}</b>
  </span>
</footer>

<style>
  .status {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: var(--size-statusbar);
    padding: 0 var(--space-3);
    border-top: var(--border-width) solid var(--color-border-subtle);
    background: var(--color-surface-nav);
    font-family: var(--font-mono);
    font-size: var(--text-mono-status);
    color: var(--color-text-muted);
    flex: none;
  }

  .item b {
    font-weight: var(--weight-medium);
    color: var(--color-text-secondary);
  }

  .has-errors,
  .has-errors b {
    color: var(--color-danger);
  }
</style>
