<script lang="ts">
  /**
   * Engine, node count, error count, and a message when something needs
   * noticing without interrupting, such as autosave pausing on a conflict.
   *
   * Everything arrives as props: a component holds no IPC and no D2 knowledge,
   * so the shell reads the render result and hands the numbers down.
   */
  import { t } from '../i18n/t';

  type Props = {
    /** Engine and node count describe a document: omitted when none is open. */
    engine?: string;
    nodes?: number;
    errors: number;
    message?: string;
  };

  let { engine, nodes, errors, message }: Props = $props();
</script>

<footer class="status">
  {#if engine !== undefined}
    <span class="item">{t('status.engine')} <b>{engine}</b></span>
  {/if}
  {#if nodes !== undefined}
    <span class="item">{t('status.nodes')} <b>{nodes}</b></span>
  {/if}
  <span class="item" class:has-errors={errors > 0}>
    {t('status.errors')} <b>{errors}</b>
  </span>
  {#if message}
    <span class="item message" role="status">{message}</span>
  {/if}
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

  .message {
    margin-left: auto;
    color: var(--color-text-primary);
  }

  .has-errors,
  .has-errors b {
    color: var(--color-danger);
  }
</style>
