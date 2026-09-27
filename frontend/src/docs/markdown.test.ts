import { describe, expect, it } from 'vitest';
import MarkdownIt from 'markdown-it';
import { parsePage, writePage } from './markdown';
import { schema } from './schema';

/** A page read and written back: what one save does to it. */
const tidy = (markdown: string) => {
  const page = parsePage(markdown);
  return writePage(page.doc, page.front);
};

/** Written in Bava's style already, so a save must leave it as it is. */
const same = (markdown: string) => expect(tidy(markdown)).toBe(markdown);

// What a page means is what any Markdown viewer shows. A soft line break
// written as a space is the one difference allowed.
const viewer = new MarkdownIt('default', { html: true });
const shown = (markdown: string) =>
  viewer
    .render(markdown.replace(/^---\r?\n[\s\S]*?\n---\r?\n/, ''))
    .replace(/\s+/g, ' ')
    .trim();

/** One save keeps what the page shows, and a second save changes nothing. */
const keepsMeaning = (markdown: string) => {
  const once = tidy(markdown);
  expect(shown(once)).toBe(shown(markdown));
  expect(tidy(once)).toBe(once);
  return once;
};

describe('text blocks', () => {
  it('keeps headings 1 to 6 and paragraphs', () => {
    same('# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six\n\nA paragraph.\n');
  });

  it('keeps a divider, and tidies other divider marks to ---', () => {
    same('Above\n\n---\n\nBelow\n');
    expect(tidy('Above\n\n***\n\nBelow\n')).toBe('Above\n\n---\n\nBelow\n');
  });

  it('writes a line break inside a block as a trailing backslash', () => {
    same('First line\\\nsecond line\n');
    expect(tidy('First line  \nsecond line\n')).toBe('First line\\\nsecond line\n');
  });

  it('closes up empty lines between blocks', () => {
    expect(tidy('One\n\n\n\nTwo\n\n\n')).toBe('One\n\nTwo\n');
  });

  it('writes an empty page as nothing', () => {
    expect(tidy('')).toBe('');
    expect(tidy('\n\n')).toBe('');
  });
});

describe('lists', () => {
  it('keeps bulleted lists, and tidies * and + to -', () => {
    same('- One\n- Two\n');
    // Two lists side by side cannot stay apart once both use -: they become one.
    expect(tidy('* One\n+ Two\n')).toBe('- One\n- Two\n');
    expect(tidy(tidy('* One\n+ Two\n'))).toBe('- One\n- Two\n');
  });

  it('keeps nested lists indented under their parent', () => {
    same('- One\n  - Inner\n- Two\n');
    same('1. One\n   1. Inner\n2. Two\n');
  });

  it('numbers a list counting up, keeping the number it starts at', () => {
    expect(tidy('1. One\n1. Two\n1. Three\n')).toBe('1. One\n2. Two\n3. Three\n');
    same('3. Three\n4. Four\n');
  });

  it('keeps to-dos, done and not', () => {
    same('- [ ] Buy milk\n- [x] Post the letter\n');
  });

  it('keeps a lettered and a roman list, with the invisible mark before each', () => {
    same('<!-- bava: list=a -->\n1. First\n2. Second\n');
    same('<!-- bava: list=i -->\n1. First\n2. Second\n');
    const page = parsePage('<!-- bava: list=a -->\n1. First\n');
    expect(page.doc.firstChild?.attrs.style).toBe('a');
  });
});

describe('quotes', () => {
  it('keeps a quote of several paragraphs', () => {
    same('> One\n>\n> Two\n');
  });
});

describe('inline marks', () => {
  it('keeps bold, italic, strikethrough, code and links, tidying _ to *', () => {
    same('**bold** *italic* ~~gone~~ `code` [link](https://example.com)\n');
    expect(tidy('__bold__ _italic_\n')).toBe('**bold** *italic*\n');
  });

  it('keeps underline, text colour and highlight as small HTML', () => {
    same('<u>under</u> <span data-color="blue">blue</span> <span data-highlight="yellow">marked</span>\n');
    const para = parsePage('<span data-color="blue">blue</span>\n').doc.firstChild!;
    expect(para.firstChild?.marks.map((m) => [m.type.name, m.attrs.name])).toEqual([['color', 'blue']]);
  });

  it('keeps marks inside marks', () => {
    same('**<u>both</u>** and <span data-color="red">**bold red**</span>\n');
  });

  it('keeps inline HTML it does not know, in its place', () => {
    same('Press <kbd>K</kbd> now.\n');
    same('A <sup>2</sup> and <span class="x">span</span>.\n');
  });

  it('keeps footnote references and inline equations exactly', () => {
    same('A claim[^1] and $a_b + c^2$ here.\n');
  });
});

describe('block colours', () => {
  it('keeps a text and background colour on a paragraph, heading, list and quote', () => {
    same('<!-- bava: color=red background=yellow -->\nA paragraph.\n');
    same('<!-- bava: color=blue -->\n## A heading\n');
    same('<!-- bava: background=green -->\n- One\n- Two\n');
    same('<!-- bava: color=purple -->\n> Quoted\n');
    const para = parsePage('<!-- bava: color=red background=yellow -->\nA paragraph.\n').doc.firstChild!;
    expect([para.attrs.color, para.attrs.background]).toEqual(['red', 'yellow']);
  });

  it('keeps a mark key it does not know', () => {
    same('<!-- bava: color=red glow=soft -->\nA paragraph.\n');
  });
});

describe('blocks kept as they are', () => {
  const kept = [
    '```d2\nwriter -> queue\n```',
    '```\n  indented   code\n```',
    '    four-space code',
    '| A | B |\n|---|:-:|\n| 1 | 2 |',
    '<div align="center">\n  <b>raw</b>\n</div>',
    '[^1]: The footnote text,\n    carried on.',
    '$$\nE = mc^2\n$$',
  ];

  it.each(kept)('keeps %j byte for byte, in its place', (block) => {
    same(`Before\n\n${block}\n\nAfter\n`);
  });

  // Inside a list item or a quote the container's indent and markers belong
  // to the container: kept with the block, they would stack up on each save.
  it('keeps a block inside a list item or a quote where it is, save after save', () => {
    const inList = '- Item\n\n  | A |\n  |---|\n  | 1 |\n';
    expect(tidy(tidy(inList))).toBe(tidy(inList));
    expect(tidy(inList)).toContain('  | A |\n  |---|\n  | 1 |');
    const inQuote = '> ```js\n> const x = 1;\n> ```\n';
    same(inQuote);
  });

  it('shows a kept block as one read-only node', () => {
    const page = parsePage('```d2\na -> b\n```\n');
    expect(page.doc.firstChild?.type.name).toBe('kept');
    expect(page.doc.firstChild?.attrs.text).toBe('```d2\na -> b\n```');
  });
});

describe('front matter', () => {
  it('reads Bava\'s settings', () => {
    const page = parsePage('---\nbava:\n  locked: true\n  width: wide\n---\n# Title\n');
    expect(page.front.settings).toEqual({ locked: true, width: 'wide' });
  });

  it('keeps every other key byte for byte', () => {
    same('---\ntitle: "Kept: as is"\ntags: [a, b]\n---\n# Title\n');
    same('---\nbava:\n  locked: true\n  future: 7\naliases:\n  - One\n---\n# Title\n');
  });

  it('writes a changed setting, keeping the rest', () => {
    const page = parsePage('---\ntitle: T\n---\nText\n');
    const written = writePage(page.doc, { ...page.front, settings: { width: 'full' } });
    expect(written).toBe('---\ntitle: T\nbava:\n  width: full\n---\nText\n');
  });

  it('leaves out a front matter with nothing in it', () => {
    const page = parsePage('---\nbava:\n  locked: true\n---\nText\n');
    expect(writePage(page.doc, { ...page.front, settings: {} })).toBe('Text\n');
  });
});

describe('a save', () => {
  const handWritten = [
    '---',
    'title: Launch',
    '---',
    'Launch plan',
    '===========',
    '',
    'Some *text* with __strong__ words and a [link](https://x.y).',
    '',
    '* one',
    '* two',
    '    * inner',
    '',
    '```js',
    'const x = 1;',
    '```',
    '',
    '> quoted',
    '',
    '1) first',
    '2) second',
    '',
  ].join('\n');

  it('tidies a hand-written page once, and a second save changes nothing', () => {
    const once = tidy(handWritten);
    expect(once).toContain('# Launch plan');
    expect(once).toContain('**strong**');
    expect(once).toContain('```js\nconst x = 1;\n```');
    expect(tidy(once)).toBe(once);
  });
});

describe('what a save must not change', () => {
  it('keeps escaped and encoded HTML as text, never turning it into formatting', () => {
    keepsMeaning('Write &lt;u&gt;x&lt;/u&gt; here.\n');
    keepsMeaning('Write \\<u>x\\</u> here.\n');
    keepsMeaning('Tom &amp; Jerry, &copy; 2026, 5&nbsp;km.\n');
    const doc = parsePage(tidy('Write &lt;u&gt;x&lt;/u&gt; here.\n')).doc;
    expect(doc.rangeHasMark(0, doc.content.size, schema.marks.underline)).toBe(false);
  });

  it('writes typed text that looks like HTML, an entity or an equation so it reads back as the same text', () => {
    const text = 'Use <u> and <span data-color="red">, &amp; and $x$ literally; it costs $5.';
    const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text(text)])]);
    const written = writePage(doc, parsePage('').front);
    expect(parsePage(written).doc.textContent).toBe(text);
    expect(parsePage(written).doc.firstChild!.childCount).toBe(1);
  });

  it('keeps link reference definitions, used or not', () => {
    const once = keepsMeaning('See [the site][s].\n\n[s]: https://example.com "T"\n\n[unused]: https://x.y\n');
    expect(once).toContain('[s]: https://example.com "T"');
    expect(once).toContain('[unused]: https://x.y');
  });

  it('keeps an image exactly as written', () => {
    same('An ![a *b*](<my pic.png> "a \\"q\\"") inline.\n');
    same('![plain](pic.png)\n');
  });

  it('keeps an invisible mark where it was when no block after it can carry it', () => {
    keepsMeaning('<!-- bava: color=red -->\n\n---\n\nLater\n');
    keepsMeaning('<!-- bava: color=red -->\n```go\nx\n```\n');
    keepsMeaning('Text\n\n<!-- bava: color=red -->\n');
  });

  it('keeps a list style on a list that is not numbered', () => {
    same('<!-- bava: list=a -->\n- a\n');
  });

  it('keeps a footnote reference straight after an exclamation mark', () => {
    same('Wow![^1]\n\n[^1]: A note.\n');
  });

  it('keeps an unclosed <u> as written, adding no close', () => {
    keepsMeaning('Use the <u> tag.\n');
    const doc = parsePage('Use the <u> tag.\n').doc;
    expect(doc.rangeHasMark(0, doc.content.size, schema.marks.underline)).toBe(false);
  });

  it('keeps a colour on the text after a span it does not know', () => {
    const doc = parsePage('<span data-color="red">a <span class="x">b</span> c</span>\n').doc;
    const para = doc.firstChild!;
    const last = para.lastChild!;
    expect(last.text).toBe(' c');
    expect(last.marks.map((m) => m.type.name)).toEqual(['color']);
  });
});

describe('front matter edges', () => {
  it('ends front matter only at a line that is --- alone', () => {
    same('---\ntitle: a---\nx: 1\n---\nBody\n');
    expect(parsePage('---\ntitle: a---\nx: 1\n---\nBody\n').doc.textContent).toBe('Body');
  });

  it('keeps the lines under bava: in their order, false settings included', () => {
    same('---\nbava:\n  future: 1\n  locked: false\n  width: narrow\n---\nText\n');
  });

  it('rewrites a changed setting on its own line', () => {
    const page = parsePage('---\nbava:\n  width: narrow\n  future: 1\n---\nText\n');
    expect(writePage(page.doc, { ...page.front, settings: { width: 'full' } })).toBe('---\nbava:\n  width: full\n  future: 1\n---\nText\n');
  });

  it('keeps a header written empty', () => {
    same('---\n---\nText\n');
  });

  it('reads a page that opens with a divider as a divider, not front matter', () => {
    const page = parsePage('---\n\n# Title\n\n---\n\nText\n');
    expect(page.front.lines).toBeNull();
    expect(page.doc.textContent).toBe('TitleText');
  });
});

// Real pages: the project's own Markdown, full of tables, code and lists.
describe('real Markdown', async () => {
  const { readFileSync } = await import('node:fs');
  const { globSync } = await import('node:fs');
  const files = globSync('../{docs,.claude,.ai}/**/*.md');

  it('finds real pages to read', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)('%s: a save keeps what it shows, a second changes nothing, and every code block survives whole', (file) => {
    const original = readFileSync(file, 'utf8');
    const once = keepsMeaning(original);
    for (const fence of original.match(/^```[^\n]*\n[\s\S]*?\n```$/gm) ?? []) {
      expect(once).toContain(fence);
    }
  });
});
