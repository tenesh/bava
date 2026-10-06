<script lang="ts">
  /**
   * A page's tags at its bottom: each a grey chip with a remove button, and
   * Add tag, a field that writes a tag as it is kept (lowercase, a dash for
   * a space) and suggests the Space's tags that start with what is typed.
   * Read-only on a locked page.
   *
   * Presentational: it reports the page's tags as they are to be.
   */
  import { tick } from 'svelte';
  import ToolIcon from './ToolIcon.svelte';
  import TagChip from './TagChip.svelte';
  import { t } from '../i18n/t';

  type Props = {
    /** The page's tags, as kept. */
    tags: string[];
    /** Every tag in the Space, for suggestions. */
    known: string[];
    readonly: boolean;
    onChange: (tags: string[]) => void;
  };

  let { tags, known, readonly, onChange }: Props = $props();

  let adding = $state(false);
  let typed = $state('');
  let highlighted = $state(0);
  let field: HTMLInputElement | undefined = $state();
  let addButton: HTMLButtonElement | undefined = $state();
  let list: HTMLDivElement | undefined = $state();

  /** What is typed, as a tag is kept. */
  const asTag = (text: string) => text.toLowerCase().replace(/\s+/g, '-');

  /** The Space's tags starting with what is typed, the page's own left out, then adding what is typed when it is new. */
  const choices = $derived.by(() => {
    const word = typed.replace(/^-+|-+$/g, '');
    if (word === '') return [];
    const found = known.filter((tag) => tag.startsWith(word) && !tags.includes(tag)).map((tag) => ({ tag, isNew: false }));
    return known.includes(word) || tags.includes(word) ? found : [...found, { tag: word, isNew: true }];
  });

  async function startAdding() {
    adding = true;
    typed = '';
    highlighted = 0;
    await tick();
    field?.focus();
  }

  async function stopAdding() {
    adding = false;
    typed = '';
    await tick();
    addButton?.focus();
  }

  function add(tag: string) {
    if (tag === '' || tags.includes(tag)) return;
    onChange([...tags, tag]);
    typed = '';
    highlighted = 0;
  }

  function input(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    typed = asTag(target.value);
    target.value = typed;
    highlighted = 0;
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      void stopAdding();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (choices.length > 0) highlighted = (highlighted + (event.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const choice = choices[highlighted];
      add(choice ? choice.tag : typed.replace(/^-+|-+$/g, ''));
    } else if (event.key === 'Backspace' && typed === '' && tags.length > 0) {
      event.preventDefault();
      [...(list?.querySelectorAll<HTMLButtonElement>('.tag-chip button') ?? [])].at(-1)?.focus();
    }
  }
</script>

{#if tags.length > 0 || !readonly}
  <div class="page-tags" bind:this={list} role="group" aria-label={t('tags.label')}>
    <span class="mark" aria-hidden="true"><ToolIcon id="tag" size="sm" /></span>
    {#each tags as tag (tag)}
      <TagChip {tag} removeLabel={t('tags.remove').replace('{tag}', tag)} onRemove={readonly ? undefined : () => onChange(tags.filter((each) => each !== tag))} />
    {/each}
    {#if !readonly}
      {#if adding}
        <span class="adding">
          <input
            bind:this={field}
            class="field"
            aria-label={t('tags.add')}
            role="combobox"
            aria-expanded={choices.length > 0}
            aria-controls="page-tags-choices"
            aria-activedescendant={choices.length > 0 ? `page-tags-choice-${highlighted}` : undefined}
            autocomplete="off"
            spellcheck="false"
            value={typed}
            oninput={input}
            onkeydown={keydown}
            onblur={() => {
              if (typed === '') void stopAdding();
            }}
          />
          {#if choices.length > 0}
            <div class="choices" id="page-tags-choices" role="listbox" aria-label={t('tags.label')}>
              {#each choices as choice, index (choice.tag + choice.isNew)}
                <div
                  id={`page-tags-choice-${index}`}
                  class="choice"
                  role="option"
                  tabindex="-1"
                  aria-selected={index === highlighted}
                  data-highlighted={index === highlighted ? '' : undefined}
                  onpointermove={() => (highlighted = index)}
                  onpointerdown={(event) => {
                    event.preventDefault();
                    add(choice.tag);
                  }}
                >
                  {choice.isNew ? t('tags.addNew').replace('{tag}', choice.tag) : choice.tag}
                </div>
              {/each}
            </div>
          {/if}
        </span>
      {:else}
        <button type="button" class="add" bind:this={addButton} onclick={() => void startAdding()}>
          <ToolIcon id="insert" size="sm" />{t('tags.add')}
        </button>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .page-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
  }

  .mark {
    display: inline-flex;
    color: var(--color-text-muted);
    margin-right: var(--space-1);
  }


  .add {
    display: inline-flex;
    align-items: center;
    border: 0;
    background: none;
    font: inherit;
    cursor: pointer;
  }



  .add {
    gap: var(--space-1);
    height: var(--size-row-sm);
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-meta);
  }

  .add:hover {
    background: var(--color-control-hover);
    color: var(--color-text-primary);
  }

  .add:active {
    background: var(--color-control-active);
  }

  .add:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }

  .adding {
    position: relative;
    display: inline-flex;
  }

  .field {
    height: var(--size-row-sm);
    width: var(--size-tag-field);
    padding: 0 var(--space-2);
    border: var(--border-width) solid var(--color-focus-ring);
    border-radius: var(--radius-full);
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-meta);
    outline: none;
  }

  /* Above the field: the tags end the page, often at the window's bottom. */
  .choices {
    position: absolute;
    bottom: calc(100% + var(--space-1));
    left: 0;
    z-index: var(--z-floating);
    min-width: var(--size-tag-field);
    padding: var(--space-1);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-floating);
  }

  .choice {
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-meta);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .choice[data-highlighted] {
    background: var(--color-selection);
  }
</style>
