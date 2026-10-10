<script lang="ts">
  /**
   * What a Markdown zip holds, for an export dialog's preview: the hidden
   * folder's parts with their counts, then its folders, pages and files as
   * a tree. A plan that failed shows why; none yet shows that it is being
   * read.
   *
   * Presentational: it shows the plan it is given.
   */
  import ToolIcon from './ToolIcon.svelte';
  import { t } from '../i18n/t';
  import type { MessageKey } from '../i18n/messages';
  import { zipPreview } from '../files/zip-preview';
  import type { ZipFile } from '../files/space.svelte';

  type Props = { plan: { files: ZipFile[]; error: string } | null };

  let { plan }: Props = $props();

  const preview = $derived(plan && !plan.error ? zipPreview(plan.files) : null);
  const counted = (n: number, one: MessageKey, many: MessageKey) => (n === 1 ? t(one) : t(many).replace('{n}', String(n)));
</script>

<!-- It scrolls when long, so it takes the keys to be scrolled by them. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="zip-contents" aria-label={t('export.holds')} role="group" tabindex="0">
  {#if plan === null}
    <p class="note">{t('export.reading')}</p>
  {:else if plan.error}
    <p class="note error" role="alert">{plan.error}</p>
  {:else if preview}
    {#if preview.hidden.attachments > 0 || preview.hidden.templates > 0 || preview.hidden.settings}
      <div class="hidden">
        <span class="label">{t('export.hidden')}</span>
        {#if preview.hidden.attachments > 0}<span>{counted(preview.hidden.attachments, 'export.attachmentsOne', 'export.attachments')}</span>{/if}
        {#if preview.hidden.templates > 0}<span>{counted(preview.hidden.templates, 'export.templatesOne', 'export.templates')}</span>{/if}
        {#if preview.hidden.settings}<span>{t('export.settings')}</span>{/if}
      </div>
    {/if}
    <ul class="tree">
      {#each preview.rows as row, index (index)}
        <li style:--depth={row.depth}>
          <ToolIcon id={row.kind === 'folder' ? 'folder' : 'page'} size="sm" />
          <span class="name" class:file={row.kind === 'file'}>{row.name}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .zip-contents {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
    height: var(--size-export-preview);
    padding: var(--space-3);
    box-sizing: border-box;
    overflow: auto;
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    background: var(--color-surface-sunken);
  }

  .zip-contents:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .tree {
    display: flex;
    flex-direction: column;
    gap: var(--space-half);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tree li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-inline-start: calc(var(--depth) * var(--space-4));
    color: var(--color-text-faint);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-secondary);
    font-size: var(--text-control);
  }

  .name.file {
    font-family: var(--font-data);
    font-size: var(--text-mono-status);
  }

  .hidden {
    display: flex;
    flex-direction: column;
    gap: var(--space-half);
    padding-bottom: var(--space-2);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
    font-family: var(--font-data);
    font-size: var(--text-mono-status);
    color: var(--color-text-muted);
  }

  .label {
    font-family: var(--font-label);
    font-size: var(--text-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
  }

  .note {
    margin: 0;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  .note.error {
    color: var(--color-danger);
  }
</style>
