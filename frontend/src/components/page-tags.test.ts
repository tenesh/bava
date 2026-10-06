// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import PageTags from './PageTags.svelte';

function setup(extra: Record<string, unknown> = {}) {
  const props = { tags: ['launch'], known: ['design', 'design-review', 'launch', 'road-map'], readonly: false, onChange: vi.fn(), ...extra };
  render(PageTags, props as never);
  return props;
}

const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('.page-tags button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name)!;
const field = () => document.querySelector<HTMLInputElement>('.page-tags input')!;
const type = (text: string) => {
  const input = field();
  input.value = text;
  flushSync(() => input.dispatchEvent(new Event('input', { bubbles: true })));
};
const key = (name: string) => flushSync(() => field().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })));
const options = () => [...document.querySelectorAll('.page-tags [role="option"]')].map((o) => o.textContent?.trim());

describe('PageTags', () => {
  it('shows each tag as a chip with its own remove button', () => {
    const props = setup();
    expect(document.querySelector('.page-tags')!.textContent).toContain('launch');
    button('Remove launch').click();
    expect(props.onChange).toHaveBeenCalledWith([]);
  });

  it('converts what is typed and adds it on Enter', () => {
    const props = setup();
    flushSync(() => button('Add tag').click());
    type('Road Map');
    expect(field().value).toBe('road-map');
    key('Enter');
    expect(props.onChange).toHaveBeenCalledWith(['launch', 'road-map']);
  });

  it('suggests the Space\'s tags that start with what is typed, leaving out the page\'s own', () => {
    setup();
    flushSync(() => button('Add tag').click());
    type('des');
    expect(options()).toEqual(['design', 'design-review', 'Add "des"']);
    type('la');
    expect(options()).toEqual(['Add "la"']);
  });

  it('adds a suggestion picked by keys', () => {
    const props = setup();
    flushSync(() => button('Add tag').click());
    type('des');
    key('ArrowDown');
    key('Enter');
    expect(props.onChange).toHaveBeenCalledWith(['launch', 'design-review']);
  });

  it('adds nothing for a tag the page has, and Escape leaves without a change', () => {
    const props = setup();
    flushSync(() => button('Add tag').click());
    type('Launch');
    key('Enter');
    expect(props.onChange).not.toHaveBeenCalled();
    type('new');
    key('Escape');
    expect(props.onChange).not.toHaveBeenCalled();
    expect(document.querySelector('.page-tags input')).toBeNull();
  });

  it('moves to the last tag\'s remove button on Backspace in an empty field', () => {
    setup({ tags: ['launch', 'q4'] });
    flushSync(() => button('Add tag').click());
    key('Backspace');
    expect(document.activeElement).toBe(button('Remove q4'));
  });

  it('on a locked page shows the tags, with no way to change them', () => {
    setup({ readonly: true });
    expect(document.querySelector('.page-tags')!.textContent).toContain('launch');
    expect(document.querySelectorAll('.page-tags button')).toHaveLength(0);
  });

  it('shows nothing on a locked page with no tags', () => {
    setup({ readonly: true, tags: [] });
    expect(document.querySelector('.page-tags')).toBeNull();
  });
});
