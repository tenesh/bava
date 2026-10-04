import { describe, expect, it } from 'vitest';
import { schema } from '../../src/docs/schema';
import { DOC_SHEETS, SUBJECTS, sheetPage, type Subject } from './document-blocks';

/** Every node and mark type the page schema declares. */
const schemaTypes = () => [...Object.keys(schema.nodes), ...Object.keys(schema.marks)].sort();

const subjects = Object.entries(SUBJECTS) as [string, Subject][];

/** Types with no page of their own: the page itself, and the words in it. */
const NOT_A_SUBJECT: Record<string, string> = {
  doc: 'the page itself: every sheet is one',
  text: 'the words in every block',
};

// Every type of the page is drawn on a sheet the document area pictures; each
// subject's page unable to draw, or empty, is on the errors or empty sheet.
describe('the Document sheets', () => {
  it('read the types from the schema', () => {
    // A guard that read nothing would pass every check below.
    expect(schemaTypes()).toEqual(expect.arrayContaining(['paragraph', 'heading', 'table_cell', 'image', 'card', 'math_inline', 'strong', 'link']));
  });

  it('hold every type of the page at rest', () => {
    const onSheets = new Set(Object.values(DOC_SHEETS).flatMap((names) => names.map((name) => (SUBJECTS[name] as Subject).type)));
    expect(schemaTypes().filter((type) => !onSheets.has(type) && !(type in NOT_A_SUBJECT))).toEqual([]);
  });

  it('have subjects only of types the schema has', () => {
    const types = new Set(schemaTypes());
    expect(subjects.filter(([, subject]) => !types.has(subject.type)).map(([name]) => name)).toEqual([]);
  });

  it('hold every page unable to draw, and every empty page, on their sheets', () => {
    const errors = sheetPage('errors').markdown;
    const empty = sheetPage('empty').markdown;
    const body = (markdown: string) => markdown.replace(/^Before it\.\n\n/, '').replace(/\n\nAfter it\.\n$/, '');
    expect(subjects.filter(([, subject]) => subject.error && !errors.includes(body(subject.error.markdown))).map(([name]) => name)).toEqual([]);
    expect(subjects.filter(([, subject]) => typeof subject.empty === 'object' && !empty.includes(body(subject.empty.markdown))).map(([name]) => name)).toEqual([]);
  });
});
