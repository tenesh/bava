<script lang="ts">
  /**
   * The Space's templates: each group's under its name, then those in no
   * group, searchable. Per template: Edit, Rename (in its row; a name its
   * group has is refused there), Duplicate, and a menu to move it to another
   * group or delete it; New template makes one.
   *
   * Presentational: it reports what to do; the caller asks before deleting.
   */
  import { tick } from 'svelte';
  import Dialog from './Dialog.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import { t } from '../i18n/t';
  import type { MenuNode } from '../canvas/context-menu';

  type Template = { group: string; name: string; path: string };

  type Props = {
    open: boolean;
    templates: Template[];
    onNew: () => void;
    onEdit: (path: string) => void;
    onRename: (path: string, name: string) => void;
    onMove: (path: string, group: string) => void;
    onDuplicate: (path: string) => void;
    onDelete: (path: string) => void;
    onOpenChange: (open: boolean) => void;
  };

  let { open, templates, onNew, onEdit, onRename, onMove, onDuplicate, onDelete, onOpenChange }: Props = $props();

  let query = $state('');
  let editing = $state<{ path: string; value: string; refusal: string | null } | null>(null);
  let menu = $state.raw<{ anchor: { x: number; y: number } } | null>(null);
  // What the open menu offers and the template it acts on; kept past its
  // close, which can come before the choice made in it.
  let menuItems = $state.raw<MenuNode[]>([]);
  let menuFor: Template | null = null;

  const groups = $derived([...new Set(templates.map((each) => each.group).filter((group) => group !== ''))]);

  /** The templates shown, by group, those in no group last. */
  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const matching = templates.filter((each) => each.name.toLowerCase().includes(q) || each.group.toLowerCase().includes(q));
    const named = [...groups, ''].map((group) => ({ group, templates: matching.filter((each) => each.group === group) }));
    return named.filter((each) => each.templates.length > 0);
  });

  async function startRename(template: Template) {
    editing = { path: template.path, value: template.name, refusal: null };
    await tick();
    const field = document.querySelector<HTMLInputElement>('.templates-list input.rename');
    field?.focus();
    field?.select();
  }

  function commitRename() {
    if (!editing) return;
    const template = templates.find((each) => each.path === editing!.path);
    const next = editing.value.trim();
    if (!template || next === '' || next === template.name) {
      editing = null;
      return;
    }
    if (templates.some((each) => each.group === template.group && each.name.toLowerCase() === next.toLowerCase() && each.path !== template.path)) {
      editing = { ...editing, refusal: t('templates.taken').replace('{name}', next) };
      return;
    }
    onRename(template.path, next);
    editing = null;
  }

  function renameKeys(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitRename();
  }

  /** Escape while renaming leaves the rename, not the dialog: taken in the window's capture phase, before Ark's. */
  function escapeRename(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.isComposing || !open || editing === null) return;
    event.preventDefault();
    event.stopPropagation();
    editing = null;
  }

  function openMenu(event: MouseEvent, template: Template) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const others = [...groups.filter((group) => group !== template.group).map((group) => ({ id: `move:${group}`, label: group }))];
    if (template.group !== '') others.push({ id: 'move:', label: t('templates.noGroup') });
    menuFor = template;
    menuItems = [
      { kind: 'item', id: 'rename', label: t('templates.renameItem'), keys: '' },
      ...(others.length > 0
        ? [{ kind: 'submenu', id: 'move', label: t('templates.moveTo'), items: others.map((each) => ({ kind: 'item', id: each.id, label: each.label, keys: '' })) } satisfies MenuNode]
        : []),
      { kind: 'separator' },
      { kind: 'item', id: 'delete', label: t('templates.deleteItem'), keys: '' },
    ];
    const anchor = { x: box.left, y: box.bottom };
    setTimeout(() => (menu = { anchor }));
  }

  function chosen(id: string) {
    const template = menuFor;
    menu = null;
    if (!template) return;
    if (id === 'rename') void startRename(template);
    else if (id === 'delete') onDelete(template.path);
    else if (id.startsWith('move:')) onMove(template.path, id.slice('move:'.length));
  }

  const label = (key: 'templates.edit' | 'templates.rename' | 'templates.duplicate' | 'templates.more', name: string) => t(key).replace('{name}', name);
</script>

<svelte:window onkeydowncapture={escapeRename} />

<Dialog {open} title={t('templates.title')} subtitle={t('templates.subtitle')} size="trash" flush closable {onOpenChange}>
  {#snippet actions()}
    <button type="button" class="bava-button" onclick={onNew}>{t('templates.new')}</button>
  {/snippet}
  <div class="templates-body">
    <div class="tools">
      <input class="bava-field search" type="search" placeholder={t('templates.search')} aria-label={t('templates.search')} bind:value={query} data-autofocus />
    </div>
    <div class="scroll templates-list">
      {#if templates.length === 0}
        <p class="none">{t('templates.empty')}</p>
      {:else if shown.length === 0}
        <p class="none">{t('templates.none')}</p>
      {:else}
        {#each shown as section (section.group)}
          <h3>{section.group || t('templates.noGroup')}</h3>
          <ul>
            {#each section.templates as template (template.path)}
              <li class="row">
                <ToolIcon id="page" size="sm" />
                {#if editing?.path === template.path}
                  <span class="renaming">
                    <input
                      class="bava-field rename"
                      aria-label={t('templates.renameField').replace('{name}', template.name)}
                      aria-invalid={editing.refusal ? 'true' : undefined}
                      value={editing.value}
                      oninput={(event) => (editing = { path: template.path, value: event.currentTarget.value, refusal: null })}
                      onkeydown={renameKeys}
                      onblur={() => {
                        if (editing && !editing.refusal) commitRename();
                      }}
                    />
                    {#if editing.refusal}<span class="refusal" role="alert">{editing.refusal}</span>{/if}
                  </span>
                {:else}
                  <button type="button" class="name" onclick={() => onEdit(template.path)}>{template.name}</button>
                {/if}
                <span class="act">
                  <button type="button" class="bava-icon-button" aria-label={label('templates.edit', template.name)} title={label('templates.edit', template.name)} onclick={() => onEdit(template.path)}>
                    <ToolIcon id="pen" size="sm" />
                  </button>
                  <button type="button" class="bava-icon-button" aria-label={label('templates.rename', template.name)} title={label('templates.rename', template.name)} onclick={() => void startRename(template)}>
                    <ToolIcon id="editPoints" size="sm" />
                  </button>
                  <button type="button" class="bava-icon-button" aria-label={label('templates.duplicate', template.name)} title={label('templates.duplicate', template.name)} onclick={() => onDuplicate(template.path)}>
                    <ToolIcon id="duplicate" size="sm" />
                  </button>
                  <button type="button" class="bava-icon-button" aria-label={label('templates.more', template.name)} title={label('templates.more', template.name)} aria-haspopup="menu" onclick={(event) => openMenu(event, template)}>
                    <ToolIcon id="more" size="sm" />
                  </button>
                </span>
              </li>
            {/each}
          </ul>
        {/each}
      {/if}
    </div>
  </div>
</Dialog>

<ContextMenu
  items={menuItems}
  open={menu !== null}
  anchor={menu?.anchor ?? null}
  onSelect={chosen}
  onOpenChange={(next) => {
    if (!next) menu = null;
  }}
/>

<style>
  .templates-body {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .tools {
    padding: var(--space-3) var(--space-4);
  }

  .search {
    width: 100%;
    max-width: var(--size-tag-filter);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 var(--space-2) var(--space-3);
  }

  h3 {
    margin: var(--space-3) var(--space-2) var(--space-1);
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--size-row-lg);
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
  }

  .row:hover {
    background: var(--color-control-hover);
  }

  .name {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-text-primary);
    font: inherit;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name:hover {
    color: var(--color-accent);
  }

  .name:active {
    color: var(--color-accent-active);
  }

  .name:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
    border-radius: var(--radius-sm);
  }

  .renaming {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .rename {
    width: var(--size-tag-field);
  }

  .refusal {
    color: var(--color-danger);
    font-size: var(--text-meta);
  }

  .act {
    display: inline-flex;
    gap: var(--space-half);
    opacity: 0;
  }

  .row:hover .act,
  .row:focus-within .act {
    opacity: 1;
  }

  .none {
    margin: var(--space-3) var(--space-2);
    color: var(--color-text-muted);
  }
</style>
