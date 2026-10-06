import { describe, expect, it } from 'vitest';
import { movedText, templateMenu } from './templates';

const TEMPLATE = '.bava/templates/Meetings/Weekly sync.md';
const text = [
  '# Weekly sync',
  '',
  'See the [Roadmap](../../../Roadmap.md) and [plan](../../../Marketing/Launch%20plan.md#goals).',
  '',
  '![Logo](../../attachments/logo.png)',
  '',
  'Out: [site](https://example.com).',
  '',
].join('\n');

describe('a page\'s text moved to another place', () => {
  it('keeps its links and images reaching what they reached, from a template to a page', () => {
    const moved = movedText(text, TEMPLATE, 'Marketing/Weekly sync.md');
    expect(moved).toContain('[Roadmap](../Roadmap.md)');
    expect(moved).toContain('[plan](Launch%20plan.md#goals)');
    expect(moved).toContain('![Logo](../.bava/attachments/logo.png)');
    expect(moved).toContain('[site](https://example.com)');
  });

  it('and back again, from a page to a template', () => {
    const page = movedText(text, TEMPLATE, 'Weekly sync.md');
    expect(page).toContain('![Logo](.bava/attachments/logo.png)');
    expect(movedText(page, 'Weekly sync.md', TEMPLATE)).toBe(text);
  });

  it('leaves text with nothing to move as it is', () => {
    expect(movedText('# Plain\n', TEMPLATE, 'Plain.md')).toBe('# Plain\n');
  });
});

describe('Add\'s New page from template', () => {
  const TEMPLATES = [
    { group: 'Design', name: 'Spec', path: '.bava/templates/Design/Spec.md' },
    { group: 'Meetings', name: 'Retro', path: '.bava/templates/Meetings/Retro.md' },
    { group: 'Meetings', name: 'Weekly sync', path: '.bava/templates/Meetings/Weekly sync.md' },
    { group: '', name: 'Bug report', path: '.bava/templates/Bug report.md' },
  ];

  it('lists each group as a submenu, then the templates in no group', () => {
    const menu = templateMenu(TEMPLATES, 'New page from template');
    expect(menu?.kind).toBe('submenu');
    if (menu?.kind !== 'submenu') return;
    expect(menu.items.map((item) => (item.kind === 'separator' ? '-' : item.label))).toEqual(['Design', 'Meetings', '-', 'Bug report']);
    const meetings = menu.items[1];
    expect(meetings.kind === 'submenu' && meetings.items.map((item) => (item.kind === 'item' ? item.id : ''))).toEqual([
      'template:.bava/templates/Meetings/Retro.md',
      'template:.bava/templates/Meetings/Weekly sync.md',
    ]);
  });

  it('is not offered when the Space has no templates', () => {
    expect(templateMenu([], 'New page from template')).toBeNull();
  });
});
