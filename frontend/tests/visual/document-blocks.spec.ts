import { expect, test, type Locator, type Page } from '@playwright/test';
import { SUBJECTS, statesOf, type BlockState, type Select, type Subject, type SubjectName } from '../fixtures/document-blocks';
import {
  THEMES,
  blockHandle,
  caretAtStart,
  caretOnWord,
  dragCells,
  editor,
  formatBubble,
  imagesLoaded,
  menus,
  openSeeded,
  personPace,
  restPointer,
  selectWord,
  shot,
  shotBlock,
  type Theme,
  withWholeLines,
} from '../helpers';

// Every block and inline piece the page holds (`harness/document-blocks.ts`,
// SUBJECTS), in every state it can be in (BLOCK_STATES), in both themes, each
// on a page of its own. The caret is never drawn in a picture, so a block
// being edited is pictured with a word of it selected under the formatting
// bubble, or with its field open. `harness/document-blocks.test.ts` fails on
// a schema type left without pictures in a state and no reason.

const AREA = 'document-blocks';

/** How a state reads in a test's name. */
const WORDS: Record<BlockState, string> = {
  rest: 'at rest',
  hovered: 'hovered, its handle showing',
  selected: 'selected',
  editing: 'being edited',
  empty: 'emptied',
  error: 'unable to draw what it holds',
};

const subjects = Object.entries(SUBJECTS) as [SubjectName, Subject][];

/** What is pictured, and what a selection or an emptying is checked on. */
const pictured = (page: Page, subject: Subject) => editor(page).locator(subject.find);
const targetOf = (page: Page, subject: Subject) => editor(page).locator(subject.target ?? subject.find).first();

/** Opens a page holding the subject, or the page a state gives, once what it holds has drawn. */
async function open(page: Page, theme: Theme, subject: Subject, seeded: { markdown: string; ready: string } | null = null) {
  await openSeeded(page, theme, seeded?.markdown ?? subject.markdown);
  await expect(pictured(page, subject).first()).toBeVisible();
  const ready = seeded?.ready ?? subject.ready;
  if (ready) await expect(editor(page).locator(ready).first()).toBeVisible();
  await imagesLoaded(editor(page));
}

/** Selects the subject as its `select` says, and checks what the selection marks. */
async function select(page: Page, subject: Subject, how: Select = subject.select!) {
  if ('drag' in how) {
    await dragCells(page, how.drag[0], how.drag[1]);
  } else if ('word' in how) {
    await selectWord(page, subject.word!);
  } else if (how.arrow === 'down') {
    await caretOnWord(page, 'Before');
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowDown');
  } else {
    await caretAtStart(page, editor(page).locator(':scope > p:nth-child(2)'));
    for (let i = 0; i < how.lead; i += 1) await page.keyboard.press('ArrowRight');
    // The editor reads where the browser's own moves left the caret a moment
    // later; a key onto an inline piece before then acts on where it was.
    await personPace(page);
    if (how.shift) for (let i = 0; i < how.shift; i += 1) await page.keyboard.press('Shift+ArrowRight');
    else await page.keyboard.press('ArrowRight');
  }
  if (subject.marked) await expect(editor(page).locator(subject.marked.selector)).toHaveCount(subject.marked.count);
  else if ('word' in how || ('shift' in how && how.shift)) await expect(formatBubble(page)).toBeVisible();
  else await expect(targetOf(page, subject)).toHaveClass(/ProseMirror-selectednode/);
}

/** Opens what edits the subject, and returns it, for the picture. */
async function edit(page: Page, subject: Subject): Promise<Locator> {
  const block = pictured(page, subject).first();
  switch (subject.edit!) {
    case 'bubble':
      await selectWord(page, subject.word!);
      return formatBubble(page);
    case 'equation': {
      await block.click();
      await expect(page.getByRole('textbox', { name: 'Equation' })).toBeFocused();
      await expect(page.locator('.equation-preview .katex')).toBeVisible();
      return page.locator('.equation-field');
    }
    case 'code-caption': {
      const caption = block.locator('.code-caption');
      await caption.click();
      await expect(caption).toBeFocused();
      return caption;
    }
    case 'caption':
    case 'rename': {
      await block.hover();
      await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
      await page.getByRole('menuitem', { name: subject.edit === 'caption' ? 'Caption' : 'Rename file' }).click();
      const field = page.locator('.link-field');
      await expect(field.getByRole('textbox')).toBeFocused();
      return field;
    }
    case 'link': {
      await selectWord(page, subject.word!);
      await page.keyboard.press('ControlOrMeta+k');
      const field = page.locator('.link-field');
      await expect(field.getByRole('textbox')).toBeFocused();
      await expect(field.getByRole('textbox')).toHaveValue('');
      // Nothing is linked yet, so there is nothing to remove.
      await expect(field.getByRole('button', { name: 'Remove link' })).toHaveCount(0);
      return field;
    }
    case 'relink': {
      // By keys: a click on a link opens its card.
      const lead = ((await block.textContent()) ?? '').indexOf(subject.word!);
      await select(page, subject, { arrow: 'right', lead, shift: subject.word!.length });
      await page.keyboard.press('ControlOrMeta+k');
      const field = page.locator('.link-field');
      await expect(field.getByRole('textbox')).toBeFocused();
      await expect(field.getByRole('textbox')).toHaveValue(subject.linksTo!);
      await expect(field.getByRole('button', { name: 'Remove link' })).toBeVisible();
      return field;
    }
  }
}

/** Deletes the words of the subject's line, from the caret at its end, as a person clears a line. */
async function empty(page: Page, subject: Subject) {
  await caretOnWord(page, subject.word!);
  await page.keyboard.press('End');
  if (subject.takesNoMarks) {
    // No bubble shows to say the editor has read a selection here, so the
    // words go one key at a time from the end, each seen gone before the next.
    const target = targetOf(page, subject);
    await expect.poll(() => target.evaluate(caretAtEnd)).toBe(true);
    await personPace(page);
    const words = (await target.textContent()) ?? '';
    for (let left = words.length - 1; left >= 0; left -= 1) {
      await page.keyboard.press('Backspace');
      await expect(target).toHaveText(words.slice(0, left));
    }
    return;
  }
  await page.keyboard.press('Shift+Home');
  // The bubble shows once the editor has read the selection: a key before then acts on the caret.
  await expect(formatBubble(page)).toBeVisible();
  await page.keyboard.press('Backspace');
  await expect(targetOf(page, subject)).toHaveText('');
}

/** Whether the caret sits after every word of `element`. */
function caretAtEnd(element: Element) {
  const selection = document.getSelection()!;
  if (!selection.isCollapsed || !element.contains(selection.anchorNode)) return false;
  const after = document.createRange();
  after.setStart(selection.anchorNode!, selection.anchorOffset);
  after.setEnd(element, element.childNodes.length);
  return after.toString() === '';
}

for (const theme of THEMES) {
  test.describe(`every Document block and inline piece, ${theme}`, () => {
    for (const [name, subject] of subjects) {
      for (const state of statesOf(subject)) {
        test(`${name}, ${WORDS[state]}`, async ({ page }) => {
          const seeded = state === 'error' ? subject.error! : state === 'empty' && subject.empty !== true ? subject.empty! : null;
          await open(page, theme, subject, seeded);
          const block = pictured(page, subject);
          let parts = block;
          if (state === 'hovered') {
            await targetOf(page, subject).hover();
            await expect(blockHandle(page)).toBeVisible();
            parts = block.or(blockHandle(page));
          } else if (state === 'selected') {
            await select(page, subject);
            await restPointer(page);
            parts = block.or(formatBubble(page));
          } else if (state === 'editing') {
            parts = block.or(await edit(page, subject));
            await restPointer(page);
            parts = await withWholeLines(page, parts);
          } else if (state === 'empty' && seeded === null) {
            await empty(page, subject);
            await restPointer(page);
          } else {
            await restPointer(page);
          }
          // No menu is left open over the page: a field opened from one has closed it.
          await expect(menus(page)).toHaveCount(0);
          await shotBlock(page, parts, shot(AREA, name, state, theme));
        });
      }
    }
  });
}
