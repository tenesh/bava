<script lang="ts">
  /**
   * The formatting bubble over selected text in the Document: bold, italic,
   * underline, strikethrough, code, link, text colour, highlight, and turn
   * into another block. Presses keep the selection (mousedown is held), so
   * formatting applies to what was selected.
   *
   * Presentational: it reports a command id and, for the menus, where the
   * button is.
   */
  import Portal from './Portal.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import { t } from '../i18n/t';
  import type { MessageKey } from '../i18n/messages';
  import type { IconId } from './tool-icons';

  type Command = 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link' | 'textColor' | 'highlight' | 'turnInto';

  type Props = {
    at: { left: number; top: number };
    active: Partial<Record<Command, boolean>>;
    onCommand: (command: Command, anchor: { x: number; y: number }) => void;
    /** Whether the block can turn into another; without, the Turn into button is left out. */
    turnable?: boolean;
    /** A command marked false here is left out: a mark the selected line cannot take. */
    offered?: Partial<Record<Command, boolean>>;
    /** Each new value after it appears puts focus on its first button. */
    focus?: number;
    /** Escape from a button: focus goes back to the page. */
    onLeave?: () => void;
    /** Focus went from the bubble to somewhere else. */
    onBlur?: () => void;
  };

  let { at, active, onCommand, turnable = true, offered = {}, focus = 0, onLeave, onBlur }: Props = $props();

  // Bound once the portal has placed the toolbar.
  let toolbar: HTMLDivElement | undefined = $state();
  const buttonsIn = () => [...(toolbar?.querySelectorAll<HTMLButtonElement>('button') ?? [])];

  // A request made before this bubble appeared is not one for it.
  // svelte-ignore state_referenced_locally
  let answered = focus;
  $effect(() => {
    if (focus === answered || !toolbar) return;
    answered = focus;
    buttonsIn()[0]?.focus();
  });

  // A toolbar is one stop: the arrows move along it, Escape leaves it.
  function keydown(event: KeyboardEvent) {
    const all = buttonsIn();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const by = event.key === 'ArrowRight' ? 1 : -1;
      all[(at + by + all.length) % all.length]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onLeave?.();
    }
  }

  const buttons: { id: Command; icon: IconId; label: MessageKey }[] = [
    { id: 'turnInto', icon: 'turnInto', label: 'bubble.turnInto' },
    { id: 'bold', icon: 'bold', label: 'bubble.bold' },
    { id: 'italic', icon: 'italic', label: 'bubble.italic' },
    { id: 'underline', icon: 'underline', label: 'bubble.underline' },
    { id: 'strike', icon: 'strike', label: 'bubble.strike' },
    { id: 'code', icon: 'inlineCode', label: 'bubble.code' },
    { id: 'link', icon: 'link', label: 'bubble.link' },
    { id: 'textColor', icon: 'textColor', label: 'bubble.textColor' },
    { id: 'highlight', icon: 'highlight', label: 'bubble.highlight' },
  ];
</script>

<Portal>
  <div
    bind:this={toolbar}
    class="bubble"
    role="toolbar"
    tabindex="-1"
    aria-label={t('bubble.label')}
    onkeydown={keydown}
    onfocusout={(event) => {
      if (!toolbar?.contains(event.relatedTarget as globalThis.Node | null)) onBlur?.();
    }}
    style:left={`${at.left}px`}
    style:top={`calc(${at.top}px - var(--size-row-lg) - var(--space-3))`}
  >
    {#each buttons.filter((b) => (turnable || b.id !== 'turnInto') && offered[b.id] !== false) as button (button.id)}
      <button
        type="button"
        class="bava-icon-button"
        aria-label={t(button.label)}
        title={t(button.label)}
        aria-pressed={button.id in active ? active[button.id] : undefined}
        onmousedown={(event) => event.preventDefault()}
        onclick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          onCommand(button.id, { x: box.left, y: box.bottom });
        }}
      >
        <ToolIcon id={button.icon} size="sm" />
      </button>
    {/each}
  </div>
</Portal>

<style>
  .bubble {
    position: fixed;
    display: flex;
    gap: var(--space-half);
    padding: var(--space-1);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-floating);
    z-index: var(--z-portal);
  }
</style>
