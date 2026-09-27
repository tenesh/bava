<script lang="ts">
  /**
   * The Space, the page's path, then what is being worked on: the canvas's
   * engine and node count, or the document's words and characters; the
   * error count when there are errors, and a message when something needs noticing without
   * interrupting, such as autosave pausing on a conflict.
   *
   * Everything arrives as props: a component holds no IPC and no D2 knowledge,
   * so the shell reads the render result and hands the numbers down.
   */
  import { t } from '../i18n/t';

  type Props = {
    /** Engine and node count describe a document: omitted when none is open. */
    engine?: string;
    nodes?: number;
    /** A document's counts: given instead of engine and nodes while it is being worked on. */
    words?: number;
    characters?: number;
    errors: number;
    message?: string;
    /** The open Space's name. */
    space?: string;
    /** The page's path inside the Space, or a loose file's full path. */
    path?: string;
  };

  let { engine, nodes, words, characters, errors, message, space, path }: Props = $props();

  const count = (n: number, one: 'status.word' | 'status.character', many: 'status.words' | 'status.characters') =>
    n === 1 ? t(one) : t(many).replace('{n}', n.toLocaleString('en-US'));
</script>

<footer class="status">
  {#if space}
    <span class="item">{space}</span>
  {/if}
  {#if path}
    <span class="item path">{path}</span>
  {/if}
  <span class="context">
    {#if engine !== undefined}
      <span class="item">{t('status.engine')} <b>{engine}</b></span>
    {/if}
    {#if nodes !== undefined}
      <span class="item">{t('status.nodes')} <b>{nodes}</b></span>
    {/if}
    {#if words !== undefined}
      <span class="item">{count(words, 'status.word', 'status.words')}</span>
    {/if}
    {#if characters !== undefined}
      <span class="item">{count(characters, 'status.character', 'status.characters')}</span>
    {/if}
  </span>
  {#if errors > 0}
    <span class="item has-errors">{t('status.errors')} <b>{errors}</b></span>
  {/if}
  {#if message}
    <span class="item message" role="status">{message}</span>
  {/if}
</footer>

<style>
  /* What is being worked on sits at the bar's far end. */
  .context {
    display: contents;
  }

  .context > :first-child {
    margin-inline-start: auto;
  }

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

  .item {
    white-space: nowrap;
  }

  /* A long path gives way before anything else does. */
  .path {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
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
