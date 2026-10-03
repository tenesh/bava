import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import MarkdownIt from 'markdown-it';
import { parsePage, writePage } from './markdown';
import { schema } from './schema';
import { Fragment, Slice } from 'prosemirror-model';
import { dateAttrs } from './dates';

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
    .replace(/> </g, '><')
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
    same('A claim[^1] and $a_b + c^2$ here.\n\n[^1]: The note.\n');
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
  const kept = ['| A | B |\n|---|:-:|\n| 1 | 2 | 3 |', '<div align="center">\n  <b>raw</b>\n</div>'];

  it.each(kept)('keeps %j byte for byte, in its place', (block) => {
    same(`Before\n\n${block}\n\nAfter\n`);
  });

  // Inside a list item or a quote the container's indent and markers belong
  // to the container: kept with the block, they would stack up on each save.
  it('keeps a block inside a list item or a quote where it is, save after save', () => {
    const inList = '- Item\n\n  | A |\n  |---|\n  | 1 | 2 |\n';
    expect(tidy(tidy(inList))).toBe(tidy(inList));
    expect(tidy(inList)).toContain('  | A |\n  |---|\n  | 1 | 2 |');
    const inQuote = '> <div>\n> raw\n> </div>\n';
    same(inQuote);
  });

  it('shows a kept block as one read-only node', () => {
    const page = parsePage('| A |\n|---|\n| 1 | 2 |\n');
    expect(page.doc.firstChild?.type.name).toBe('kept');
    expect(page.doc.firstChild?.attrs.text).toBe('| A |\n|---|\n| 1 | 2 |');
  });
});

describe('code blocks', () => {
  it('keeps a fence with its language, and the code byte for byte', () => {
    same('```go\nfunc main() {\n\tprintln("hi")  \n}\n```\n');
    same('```d2\nwriter -> queue\n```\n');
    same('```\n  indented   code\n\n\nafter blank lines\n```\n');
    const block = parsePage('```go\nx := 1\n```\n').doc.firstChild!;
    expect([block.type.name, block.attrs.language, block.textContent]).toEqual(['code_block', 'go', 'x := 1']);
  });

  it('keeps what follows the language on the opening line', () => {
    same('```js title="app.js" {1,3}\nlet a;\n```\n');
  });

  it('writes a fence longer than any run of backticks in the code', () => {
    const once = keepsMeaning('````md\n```go\nx\n```\n````\n');
    expect(once).toBe('````md\n```go\nx\n```\n````\n');
  });

  it('writes a tilde fence and an indented block as backtick fences', () => {
    expect(keepsMeaning('~~~py\nx = 1\n~~~\n')).toBe('```py\nx = 1\n```\n');
    expect(keepsMeaning('Text\n\n    four-space code\n')).toBe('Text\n\n```\nfour-space code\n```\n');
  });

  it('keeps wrap and a caption in the mark above it', () => {
    same('<!-- bava: wrap caption="Start the server" -->\n```go\nfunc main() {}\n```\n');
    same('<!-- bava: caption="Says &quot;hi&quot; &amp; bye &#45;&#45; twice" -->\n```\nx\n```\n');
    const block = parsePage('<!-- bava: wrap caption="Says &quot;hi&quot; &#45;&#45; ok" -->\n```\nx\n```\n').doc.firstChild!;
    expect([block.attrs.wrap, block.attrs.caption]).toEqual([true, 'Says "hi" -- ok']);
  });

  it('keeps a code block inside a list item and a quote, save after save', () => {
    same('- Item\n\n  ```js\n  const x = 1;\n  ```\n');
    same('> ```js\n> const x = 1;\n> ```\n');
  });
});

describe('callouts', () => {
  it('reads each kind and writes it back', () => {
    for (const kind of ['info', 'note', 'success', 'warning', 'error']) {
      same(`> [!${kind}]\n> Some text.\n`);
      expect(parsePage(`> [!${kind}]\n> Some text.\n`).doc.firstChild!.attrs.kind).toBe(kind);
    }
  });

  it('keeps several blocks inside a callout', () => {
    same('> [!warning]\n> First.\n>\n> - a\n> - b\n');
  });

  it('keeps a kind it does not know, a title and a fold sign as written', () => {
    same('> [!tip] Heads up\n> Text.\n');
    same('> [!NOTE]- Folded\n> Text.\n');
    const callout = parsePage('> [!tip]+ Heads up\n> Text.\n').doc.firstChild!;
    expect([callout.type.name, callout.attrs.kind, callout.attrs.fold, callout.attrs.title]).toEqual(['callout', 'tip', '+', ' Heads up']);
  });

  // A callout reader shows the two the same; one that does not know callouts
  // shows the marker on a line of its own either way.
  it('tidies a blank line after the marker away', () => {
    const once = tidy('> [!info]\n>\n> Text.\n');
    expect(once).toBe('> [!info]\n> Text.\n');
    expect(tidy(once)).toBe(once);
  });

  it('keeps a custom callout\'s colour and icon', () => {
    same('<!-- bava: color=purple icon=🚀 -->\n> [!note]\n> Launch is on Friday.\n');
    const callout = parsePage('<!-- bava: color=purple icon=🚀 -->\n> [!note]\n> Go.\n').doc.firstChild!;
    expect([callout.attrs.color, callout.attrs.icon]).toEqual(['purple', '🚀']);
  });

  it('leaves a quote that only mentions a marker later as a quote', () => {
    expect(parsePage('> Text then [!info]\n').doc.firstChild!.type.name).toBe('blockquote');
  });
});

describe('toggles', () => {
  it('reads a toggle list and writes it back', () => {
    same('<details>\n<summary>What ships</summary>\n\nThe editor.\n\n- and the tree\n\n</details>\n');
    const toggle = parsePage('<details>\n<summary>What ships</summary>\n\nThe editor.\n\n</details>\n').doc.firstChild!;
    expect([toggle.type.name, toggle.firstChild!.textContent, toggle.childCount]).toEqual(['toggle', 'What ships', 2]);
  });

  it('keeps open, and characters HTML would read, in the summary', () => {
    same('<details open>\n<summary>Tom &amp; Jerry &lt;3</summary>\n\nText.\n\n</details>\n');
    expect(parsePage('<details>\n<summary>Tom &amp; Jerry</summary>\n\nText.\n\n</details>\n').doc.firstChild!.firstChild!.textContent).toBe('Tom & Jerry');
  });

  it('reads toggles inside toggles', () => {
    same('<details>\n<summary>Outer</summary>\n\n<details>\n<summary>Inner</summary>\n\nDeep.\n\n</details>\n\n</details>\n');
  });

  it('tidies a summary on the opening line, keeping what it shows', () => {
    expect(keepsMeaning('<details><summary>One line</summary>\n\nText.\n\n</details>\n')).toBe(
      '<details>\n<summary>One line</summary>\n\nText.\n\n</details>\n',
    );
  });

  it('keeps details it cannot read as a toggle as written', () => {
    same('<details>\n<summary>S</summary>\nText with no blank line.\n</details>\n');
    same('<details>\n<summary>Never closed</summary>\n\nText.\n');
  });

  it('keeps the mark of a toggle heading, which no longer folds, as written', () => {
    same('<!-- bava: toggle -->\n## Launch checklist\n\nShown.\n');
    same('<!-- bava: color=red toggle -->\n# Both\n');
    // After an edit elsewhere on the page too.
    const { doc, front } = parsePage('<!-- bava: toggle -->\n## Launch\n\nOld.\n');
    const edited = doc.replace(doc.content.size - 5, doc.content.size - 1, new Slice(Fragment.from(schema.text('New.')), 0, 0));
    expect(writePage(edited, front)).toBe('<!-- bava: toggle -->\n## Launch\n\nNew.\n');
  });
});

describe('equations', () => {
  it('reads a block equation and writes it back', () => {
    same('$$\n\\int_0^1 x^2\\,dx = \\tfrac{1}{3}\n$$\n');
    same('$$E = mc^2$$\n');
    const block = parsePage('$$\na^2\n+ b^2\n$$\n').doc.firstChild!;
    expect([block.type.name, block.attrs.tex]).toEqual(['math_block', 'a^2\n+ b^2']);
  });

  it('reads an inline equation and writes it exactly', () => {
    same('The area is $\\pi r^2$, and costs \\$5.\n');
    const para = parsePage('Area $\\pi r^2$.\n').doc.firstChild!;
    expect(para.child(1).type.name).toBe('math_inline');
    expect(para.child(1).attrs.tex).toBe('\\pi r^2');
  });

  it('leaves dollars that are not an equation as text', () => {
    const para = parsePage('It costs $5 and $10 more.\n').doc.firstChild!;
    expect(para.childCount).toBe(1);
    expect(para.textContent).toBe('It costs $5 and $10 more.');
  });
});

describe('footnotes', () => {
  it('reads references and notes, and writes the notes at the foot', () => {
    same('Bava keeps files plain.[^1] And local.[^2]\n\n[^1]: No database.\n\n[^2]: No service.\n');
    const doc = parsePage('Plain.[^1]\n\n[^1]: No database.\n').doc;
    expect(doc.lastChild!.type.name).toBe('footnotes');
    expect(doc.firstChild!.child(1).type.name).toBe('footnote_ref');
  });

  it('moves notes defined mid-page to the foot, in the order first referred to', () => {
    const once = tidy('B first.[^b] A second.[^a]\n\n[^a]: Note a.\n\nMiddle.\n\n[^b]: Note b.\n');
    expect(once).toBe('B first.[^b] A second.[^a]\n\nMiddle.\n\n[^b]: Note b.\n\n[^a]: Note a.\n');
    expect(tidy(once)).toBe(once);
  });

  it('keeps a note of several paragraphs, and a note nothing refers to', () => {
    same('Text.[^long]\n\n[^long]: First paragraph.\n\n    Second paragraph.\n\n[^unused]: Never cited.\n');
  });
});

describe('the contents block', () => {
  it('rewrites the list from the page\'s headings', () => {
    const page = '<!-- bava: contents -->\n\n- [Old](#old)\n\n<!-- bava: /contents -->\n\n# Goals\n\n## Beta launch\n\n## Beta launch\n\n### Deep\n\n# Risks & costs\n';
    const once = tidy(page);
    expect(once).toBe(
      '<!-- bava: contents -->\n\n- [Goals](#goals)\n  - [Beta launch](#beta-launch)\n  - [Beta launch](#beta-launch-1)\n    - [Deep](#deep)\n- [Risks & costs](#risks--costs)\n\n<!-- bava: /contents -->\n\n# Goals\n\n## Beta launch\n\n## Beta launch\n\n### Deep\n\n# Risks & costs\n',
    );
    expect(tidy(once)).toBe(once);
    expect(parsePage(page).doc.firstChild!.type.name).toBe('contents');
  });

  it('nests a heading that skips a level under the nearest one above it', () => {
    const once = tidy('<!-- bava: contents -->\n<!-- bava: /contents -->\n\n# One\n\n### Three\n');
    expect(once).toContain('- [One](#one)\n  - [Three](#three)\n');
  });

  it('keeps a contents mark with no end as written', () => {
    same('<!-- bava: contents -->\n\nText.\n');
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

describe('what the new blocks must not lose', () => {
  it.each([
    ['a divider', '> [!info]\n>\n> ---\n>\n> Text.\n'],
    ['a coloured paragraph', '> [!info]\n>\n> <!-- bava: color=red -->\n> Red.\n'],
    ['a toggle heading', '> [!info]\n>\n> <!-- bava: toggle -->\n> ## Head\n'],
    ['a toggle', '> [!info]\n>\n> <details>\n> <summary>S</summary>\n>\n> B.\n>\n> </details>\n'],
    ['a table', '> [!info]\n>\n> | A   |\n> |-----|\n> | 1   |\n'],
  ])('keeps a callout whose first block is %s', (_name, page) => {
    same(page);
    expect(parsePage(page).doc.firstChild!.type.name).toBe('callout');
  });

  it('keeps every word of a callout whose title line runs into its body', () => {
    for (const page of ['> [!note] `code\n> span` body\n', '> [!note] [link\n> text](http://u) more\n', '> [!note] **bold\n> still** end\n']) {
      const once = tidy(page);
      expect(tidy(once)).toBe(once);
      for (const word of ['span', 'body', 'text', 'http://u', 'still', 'end'].filter((w) => page.includes(w))) expect(once).toContain(word);
    }
  });

  it('writes inline TeX that ends in or holds backslashes and dollars so it reads back as an equation', () => {
    for (const tex of ['a \\\\', 'x\\$y', '\\$5']) {
      const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('A '), schema.nodes.math_inline.create({ tex })])]);
      const back = parsePage(writePage(doc, parsePage('').front)).doc.firstChild!;
      expect(back.lastChild!.type.name).toBe('math_inline');
      expect(back.lastChild!.attrs.tex).toBe(tex);
    }
    same('Escaped $x\\$y$ and $\\\\$ here.\n');
  });

  it('keeps a tight numbered list with a code block in an item, save after save', () => {
    const page = '1. Run:\n   ```sh\n   make\n   ```\n2. Done\n';
    const once = tidy(page);
    expect(tidy(once)).toBe(once);
    expect(once).toContain('```sh\n   make\n   ```');
  });

  it('writes loose a tight list whose item gained a second paragraph, so a second save changes nothing', () => {
    const p = (text: string) => schema.node('paragraph', null, [schema.text(text)]);
    const doc = schema.node('doc', null, [
      schema.nodes.bullet_list.create({ tight: true }, [schema.nodes.list_item.create(null, [p('One'), p('More')]), schema.nodes.list_item.create(null, [p('Two')])]),
    ]);
    const once = writePage(doc, parsePage('').front);
    expect(once).toBe('- One\n\n  More\n\n- Two\n');
    expect(tidy(once)).toBe(once);
  });

  it('keeps a tilde fence whose opening line holds a backtick', () => {
    same('~~~js `x`\nlet a;\n~~~\n');
  });

  it('reads a table or a </details> straight after a paragraph', () => {
    const table = 'Para\n| a | b |\n|---|---|\n| 1 | 2 |\n';
    expect(tidy(table)).toContain('| a   | b   |\n|-----|-----|\n| 1   | 2   |');
    const details = '<details>\n<summary>S</summary>\n\nBody\n</details>\n';
    expect(parsePage(details).doc.firstChild!.type.name).toBe('toggle');
    expect(tidy(tidy(details))).toBe(tidy(details));
  });

  it('keeps the backslashes in a toggle summary', () => {
    same('<details>\n<summary>a \\* b &amp; c</summary>\n\nBody.\n\n</details>\n');
  });

  it('quotes an icon that could end the mark', () => {
    const page = '> [!note]\n> Go.\n';
    const doc = parsePage(page).doc;
    const custom = doc.type.create(null, [doc.firstChild!.type.create({ ...doc.firstChild!.attrs, color: 'red', icon: 'x-->' }, doc.firstChild!.content)]);
    const written = writePage(custom, parsePage('').front);
    expect(written.split('\n')[0]).toMatch(/^<!-- bava: .* -->$/);
    expect(parsePage(written).doc.firstChild!.attrs.icon).toBe('x-->');
  });

  it('keeps a footnote reference that starts a line before a colon in the text', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.nodes.footnote_ref.create({ label: '1' }), schema.text(': hello')]),
      schema.nodes.footnotes.create(null, schema.nodes.footnote.create({ label: '1' }, schema.node('paragraph', null, [schema.text('Note.')]))),
    ]);
    const written = writePage(doc, parsePage('').front);
    expect(parsePage(written).doc.firstChild!.textContent).toBe('[^1]: hello');
    expect(tidy(written)).toBe(written);
  });

  it('keeps anything but a list between the contents marks as written', () => {
    same('<!-- bava: contents -->\n\nProse someone wrote here.\n\n<!-- bava: /contents -->\n');
  });

  it('keeps $$…$$ inside a line as written', () => {
    same('a $$x$$ b\n');
  });

  it('keeps what follows a fence\'s language, and before a callout title, as written', () => {
    same('```go\tmeta   more\nx\n```\n');
    same('> [!info]\tTitle\n> Text.\n');
  });
});

describe('tables', () => {
  const cellTexts = (markdown: string) => {
    const rows: string[][] = [];
    parsePage(markdown).doc.firstChild!.forEach((row) => {
      const cells: string[] = [];
      row.forEach((cell) => cells.push(`${cell.type.name === 'table_header' ? 'th' : 'td'}:${cell.textContent}`));
      rows.push(cells);
    });
    return rows;
  };

  it('reads a Markdown table into rows and cells, the first row as headers', () => {
    const page = '| Name | Role   | Hours |\n|------|:------:|------:|\n| Ana  | Design | 12    |\n';
    same(page);
    expect(cellTexts(page)).toEqual([
      ['th:Name', 'th:Role', 'th:Hours'],
      ['td:Ana', 'td:Design', 'td:12'],
    ]);
    const header = parsePage(page).doc.firstChild!.firstChild!;
    expect([header.child(0).attrs.align, header.child(1).attrs.align, header.child(2).attrs.align]).toEqual([null, 'center', 'right']);
  });

  it('tidies a hand-written table to line up, keeping what it shows', () => {
    const once = keepsMeaning('|a|b|\n|-|:-|\n|longer cell|x|\n');
    expect(once).toBe('| a           | b   |\n|-------------|:----|\n| longer cell | x   |\n');
  });

  it('keeps pipes, line breaks, formatting and code in cells', () => {
    const once = tidy('| A |\n|---|\n| a \\| b<br>**c** `x\\|y` |\n');
    expect(tidy(once)).toBe(once);
    expect(once).toContain('| a \\| b<br>**c** `x\\|y` |');
    const cell = parsePage('| A |\n|---|\n| a \\| b<br>c |\n').doc.firstChild!.child(1).firstChild!.firstChild!;
    expect(cell.textContent).toBe('a | bc');
    expect(cell.child(1).type.name).toBe('hard_break');
  });

  it('reads and writes the HTML form, with merges, colours, widths and a header column', () => {
    const page = [
      '<table>',
      '<colgroup><col width="120"><col><col></colgroup>',
      '<tr><th>Name</th><th>Role</th><th>Hours</th></tr>',
      '<tr><th>Ana</th><td colspan="2" align="center" data-background="yellow"><strong>Design</strong><br>and <a href="https://x.y">review</a></td></tr>',
      '</table>',
      '',
    ].join('\n');
    same(page);
    const table = parsePage(page).doc.firstChild!;
    const merged = table.child(1).child(1);
    expect([merged.attrs.colspan, merged.attrs.background, merged.attrs.align]).toEqual([2, 'yellow', 'center']);
    expect(table.firstChild!.firstChild!.attrs.colwidth).toEqual([120]);
  });

  it('keeps text in an HTML cell as text, never as Markdown', () => {
    same('<table>\n<tr><th>*a* &amp; &lt;b&gt;</th></tr>\n<tr><td data-background="red">b</td></tr>\n</table>\n');
    expect(cellTexts('<table>\n<tr><th>*a* &amp; &lt;b&gt;</th></tr>\n<tr><td data-background="red">b</td></tr>\n</table>\n')[0]).toEqual(['th:*a* & <b>']);
  });

  it('writes a table as HTML once it uses a rich option, and as Markdown once it does not', () => {
    const n = schema.nodes;
    const para = (text: string) => n.paragraph.create(null, schema.text(text));
    const doc = n.doc.create(null, [
      n.table.create(null, [
        n.table_row.create(null, [n.table_header.create(null, para('A')), n.table_header.create(null, para('B'))]),
        n.table_row.create(null, [n.table_cell.create({ background: 'blue' }, para('1')), n.table_cell.create(null, para('2'))]),
      ]),
    ]);
    const html = writePage(doc, parsePage('').front);
    expect(html.startsWith('<table>')).toBe(true);
    expect(html).toContain('data-background="blue"');
    expect(tidy('<table>\n<tr><th>A</th><th>B</th></tr>\n<tr><td>1</td><td>2</td></tr>\n</table>\n')).toBe('| A   | B   |\n|-----|-----|\n| 1   | 2   |\n');
  });

  it('keeps a table it cannot hold exactly as written', () => {
    same('<table class="wide">\n<tr><td>a</td></tr>\n</table>\n');
    same('<table>\n<tr><td><ul><li>a</li></ul></td></tr>\n</table>\n');
    same('| A |\n|---|\n| 1 | extra |\n');
    expect(parsePage('| A |\n|---|\n| 1 | extra |\n').doc.firstChild!.type.name).toBe('kept');
  });

  it('keeps an HTML table whose spans do not make an exact grid as written', () => {
    for (const page of [
      'Before\n\n<table>\n<tr><td colspan="0">keep me</td></tr>\n</table>\n\nAfter\n',
      '<table>\n<tr><td rowspan="3">a</td><td>b</td></tr>\n<tr><td>c</td></tr>\n</table>\n',
      '<table>\n<tr><td>a</td><td>b</td></tr>\n<tr><td>c</td></tr>\n</table>\n',
    ]) {
      same(page);
      expect(parsePage(page).doc.textContent).toContain(page.includes('keep me') ? 'keep me' : 'a');
    }
  });

  it('puts each width on its real column under a rowspan, save after save', () => {
    const page = '<table>\n<colgroup><col width="100"><col></colgroup>\n<tr><th rowspan="2">a</th><th>b</th></tr>\n<tr><td>c</td></tr>\n</table>\n';
    same(page);
    const other = '<table>\n<colgroup><col><col width="90"></colgroup>\n<tr><th rowspan="2">a</th><th>b</th></tr>\n<tr><td>c</td></tr>\n</table>\n';
    same(other);
  });

  it('keeps footnote references, images, other inline HTML and link titles in the HTML form', () => {
    const page = '<table>\n<tr><th>A</th></tr>\n<tr><td data-background="red">See[^1] ![i](p.png) <kbd>K</kbd> <a href="u" title="T">l</a> &#91;^x]</td></tr>\n</table>\n\n[^1]: Note.\n';
    same(page);
    const cell = parsePage(page).doc.firstChild!.child(1).firstChild!.firstChild!;
    const kinds: string[] = [];
    cell.forEach((child) => kinds.push(child.type.name));
    expect(kinds).toContain('footnote_ref');
    expect(kinds.filter((k) => k === 'keptInline').length).toBeGreaterThanOrEqual(3);
    expect(cell.textContent).toContain('[^x]');
  });

  it('writes a Markdown cell without edge spaces, and keeps trailing line breaks', () => {
    const n = schema.nodes;
    const cell = (type: typeof n.table_cell, ...content: import('prosemirror-model').Node[]) => type.create(null, n.paragraph.create(null, content));
    const doc = n.doc.create(null, [
      n.table.create(null, [
        n.table_row.create(null, [cell(n.table_header, schema.text(' a ')), cell(n.table_header, schema.text('  b'))]),
        n.table_row.create(null, [cell(n.table_cell, schema.text('c'), n.hard_break.create()), cell(n.table_cell, n.hard_break.create())]),
      ]),
    ]);
    const once = writePage(doc, parsePage('').front);
    expect(tidy(once)).toBe(once);
    expect(once).toContain('| a ');
    expect(once).toContain('c<br>');
  });

  it('keeps a table in a list item and in a quote, save after save', () => {
    same('- Item\n\n  | A   |\n  |-----|\n  | 1   |\n');
    same('> | A   |\n> |-----|\n> | 1   |\n');
    same('- Item\n\n  <table>\n  <tr><th>A</th></tr>\n  <tr><td data-background="red">1</td></tr>\n  </table>\n');
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

// Real pages: a fixed copy of the project's own Markdown, full of tables,
// code and lists, kept beside this test so what it reads never changes under it.
describe('real Markdown', () => {
  const corpus = new URL('./__fixtures__/pages/', import.meta.url);
  const files = readdirSync(corpus).filter((name) => name.endsWith('.md'));
  const read = (name: string) => readFileSync(new URL(name, corpus), 'utf8');

  it('reads pages that hold headings, both kinds of list, code and tables', () => {
    const kinds = new Set<string>();
    for (const file of files) parsePage(read(file)).doc.descendants((node) => void kinds.add(node.type.name));
    expect([...kinds]).toEqual(expect.arrayContaining(['heading', 'bullet_list', 'ordered_list', 'code_block', 'table']));
  });

  // What it shows includes every code block's code, character for character.
  it.each(files)('%s: a save keeps what it shows, and a second changes nothing', (file) => {
    keepsMeaning(read(file));
  });
});

describe('date chips', () => {
  const dates = (markdown: string) => {
    const out: { date: string; text: string }[] = [];
    parsePage(markdown).doc.descendants((node) => {
      if (node.type.name === 'date') out.push({ date: node.attrs.date, text: node.attrs.text });
    });
    return out;
  };

  it('reads a date tag as a chip and writes it back exactly', () => {
    const page = 'The launch is on <time datetime="2026-10-02">2 Oct 2026</time>.\n';
    same(page);
    expect(dates(page)).toEqual([{ date: '2026-10-02', text: '2 Oct 2026' }]);
  });

  it('keeps the words of a date written by hand', () => {
    const page = 'Due <time datetime="2026-10-02">next Friday</time>.\n';
    same(page);
    expect(dates(page)).toEqual([{ date: '2026-10-02', text: 'next Friday' }]);
  });

  it('writes a changed date in its own words', () => {
    const { doc, front } = parsePage('Due <time datetime="2026-10-02">next Friday</time>.\n');
    let at = -1;
    doc.descendants((node, pos) => {
      if (node.type.name === 'date') at = pos;
    });
    const changed = doc.type.schema.nodes.date.create(dateAttrs('2026-11-05'));
    const next = doc.replace(at, at + 1, new Slice(Fragment.from(changed), 0, 0));
    expect(writePage(next, front)).toBe('Due <time datetime="2026-11-05">5 Nov 2026</time>.\n');
  });

  it('keeps as written a date tag holding more than text, or no real day', () => {
    for (const page of [
      'On <time datetime="2026-10-02"><b>2 Oct</b></time>.\n',
      'On <time datetime="2026-02-30">30 Feb</time>.\n',
      'On <time datetime="2026-10">October</time>.\n',
      'On <time>2 Oct</time>.\n',
      'On <time datetime="2026-10-02" class="x">2 Oct</time>.\n',
      'On <time datetime="2026-10-02">*2 Oct*</time>.\n',
      'On <time datetime="2026-10-02"></time>.\n',
    ]) {
      same(page);
      expect(dates(page)).toEqual([]);
    }
  });

  it('leaves a date typed as text as text', () => {
    same('Ship on 2026-10-02.\n');
    expect(dates('Ship on 2026-10-02.\n')).toEqual([]);
  });

  it('keeps a chip inside a table cell, in both forms', () => {
    const plain = `| When${' '.repeat(41)} |\n|${'-'.repeat(47)}|\n| <time datetime="2026-10-02">2 Oct 2026</time> |\n`;
    same(plain);
    expect(dates(plain)).toHaveLength(1);
    const rich = '<table>\n<tr><th>When</th></tr>\n<tr><td data-background="yellow"><time datetime="2026-10-02">2 Oct 2026</time></td></tr>\n</table>\n';
    same(rich);
    expect(dates(rich)).toHaveLength(1);
  });
});

describe('images and videos', () => {
  const first = (markdown: string) => parsePage(markdown).doc.firstChild!;

  it('reads an image alone on its line as an image block, and writes it back as written', () => {
    const page = '![The new editor](.bava/attachments/editor.png)\n';
    same(page);
    const image = first(page);
    expect(image.type.name).toBe('image');
    expect(image.attrs).toMatchObject({ src: '.bava/attachments/editor.png', alt: 'The new editor', title: null });
  });

  it('reads its settings from the mark above, and writes them in Bava\'s order', () => {
    same('<!-- bava: width=medium ratio=16:9 align=left caption="The new editor" -->\n![The new editor](.bava/attachments/editor.png)\n');
    expect(first('<!-- bava: width=medium ratio=16:9 align=left caption="The new editor" -->\n![a](a.png)\n').attrs).toMatchObject({
      width: 'medium',
      ratio: '16:9',
      align: 'left',
      caption: 'The new editor',
    });
    expect(tidy('<!-- bava: caption="c" align=right width=small -->\n![a](a.png)\n')).toBe('<!-- bava: width=small align=right caption="c" -->\n![a](a.png)\n');
  });

  it('reads a video by its file type, with its poster, loop and mute', () => {
    const page = '<!-- bava: width=large poster="demo poster.png" loop muted -->\n![Demo](.bava/attachments/demo.mp4)\n';
    same(page);
    const video = first(page);
    expect(video.type.name).toBe('video');
    expect(video.attrs).toMatchObject({ src: '.bava/attachments/demo.mp4', width: 'large', poster: 'demo poster.png', loop: true, muted: true });
    for (const ext of ['webm', 'MOV']) expect(first(`![v](v.${ext})\n`).type.name).toBe('video');
    for (const ext of ['jpg', 'jpeg', 'gif', 'webp', 'svg', 'PNG']) expect(first(`![i](i.${ext})\n`).type.name).toBe('image');
  });

  it('reads an image or a video on the web as a block', () => {
    same('<!-- bava: width=large -->\n![Chart](https://example.com/chart.png)\n');
    expect(first('![Chart](https://example.com/chart.png)\n').type.name).toBe('image');
    expect(first('![Clip](http://example.com/clip.mp4)\n').type.name).toBe('video');
  });

  it('keeps a hand-written image line exactly as written', () => {
    for (const page of ['![a *b*](<my pic.png> "The \\"title\\"")\n', '![](a.png)\n', '![a](my%20pic.png?v=2#x)\n']) {
      expect(first(page).type.name, page).toBe('image');
    }
    // Spaces around the line mean nothing to any reader: they go.
    expect(keepsMeaning('  ![a](a.png)  \n')).toBe('![a](a.png)\n');
    same('![a *b*](<my pic.png> "The \\"title\\"")\n');
    same('![](a.png)\n');
    same('![a](my%20pic.png?v=2#x)\n');
  });

  it('keeps an image by reference exactly as written: its address is its definition\'s', () => {
    same('![x][r]\n\n[r]: a.png\n');
    same('![r]\n\n[r]: a.png\n');
  });

  it('keeps an image in a line of text, of another type, from the disk\'s root or another scheme, or opening a list item, as written', () => {
    for (const page of ['An ![a](pic.png) inline.\n', '![a](file.pdf)\n', '![a](a.png) ![b](b.png)\n', '![a](a.png)\nmore\n', '- ![a](a.png)\n', '![a](/tmp/a.png)\n', '![a](ftp://example.com/a.png)\n']) {
      keepsMeaning(page);
      const kinds: string[] = [];
      parsePage(page).doc.descendants((node) => {
        kinds.push(node.type.name);
      });
      expect(kinds, page).not.toContain('image');
      expect(kinds, page).toContain('keptInline');
    }
  });

  it('holds an image inside a quote, a callout, a toggle and a list item after its first line', () => {
    same('> ![a](a.png)\n');
    same('> [!note]\n>\n> ![a](a.png)\n');
    same('<details>\n<summary>More</summary>\n\n![a](a.png)\n\n</details>\n');
    same('- item\n\n  ![a](a.png)\n');
    const kinds: string[] = [];
    parsePage('- item\n\n  ![a](a.png)\n').doc.descendants((node) => {
      kinds.push(node.type.name);
    });
    expect(kinds).toContain('image');
  });

  it('keeps a key it does not take, or a value it does not know, as written', () => {
    same('<!-- bava: loop -->\n![a](a.png)\n');
    expect(first('<!-- bava: loop -->\n![a](a.png)\n').attrs.extra).toBe('loop');
    same('<!-- bava: width=huge ratio=2:1 align=center poster="../x.png" -->\n![a](a.mp4)\n');
    expect(first('<!-- bava: width=huge -->\n![a](a.png)\n').attrs).toMatchObject({ width: null, extra: 'width=huge' });
  });

  it('writes a new image from its address and words', () => {
    const n = schema.nodes;
    const doc = n.doc.create(null, [
      n.image.create({ src: 'my%20pic.png', alt: 'a [b] *c*', width: 'full' }),
      n.paragraph.create(null, schema.text('After')),
    ]);
    const written = writePage(doc, parsePage('').front);
    expect(written).toBe('<!-- bava: width=full -->\n![a \\[b\\] \\*c\\*](my%20pic.png)\n\nAfter\n');
    expect(parsePage(written).doc.firstChild!.attrs).toMatchObject({ src: 'my%20pic.png', alt: 'a [b] *c*', width: 'full' });
  });

  it('writes an image whose address changed from its new address, not as it was written', () => {
    const page = parsePage('![a](<old pic.png> "T")\n');
    const image = page.doc.firstChild!;
    const doc = page.doc.type.create(null, [image.type.create({ ...image.attrs, src: 'new.png' }), ...page.doc.content.content.slice(1)]);
    expect(writePage(doc, page.front)).toBe('![a](new.png "T")\n');
  });
});

describe('online videos and cards', () => {
  const first = (markdown: string) => parsePage(markdown).doc.firstChild!;

  it('reads an online video as a video block, and writes it back as written', () => {
    const page = '<!-- bava: width=large caption="The launch demo" -->\n![Launch demo](https://www.youtube.com/watch?v=abc123)\n';
    same(page);
    expect(first(page).type.name).toBe('video');
    expect(first(page).attrs).toMatchObject({ src: 'https://www.youtube.com/watch?v=abc123', width: 'large', caption: 'The launch demo' });
    same('![Talk](https://vimeo.com/76979871)\n');
    expect(first('![Talk](https://vimeo.com/76979871)\n').type.name).toBe('video');
    // Any other site's page stays as written.
    expect(first('![x](https://example.com/watch?v=1)\n').type.name).toBe('paragraph');
  });

  it('reads a link alone on its line with a card mark as a card, simple or extended', () => {
    const file = '<!-- bava: card -->\n[Q3 report.pdf](.bava/attachments/Q3%20report.pdf)\n';
    same(file);
    expect(first(file).type.name).toBe('card');
    expect(first(file).attrs).toMatchObject({ href: '.bava/attachments/Q3%20report.pdf', text: 'Q3 report.pdf', look: 'card' });
    const web =
      '<!-- bava: card=extended description="How we ship each week." icon="example.com icon.png" image="example.com picture.png" -->\n[Release notes](https://example.com/notes "Notes")\n';
    same(web);
    expect(first(web).attrs).toMatchObject({
      href: 'https://example.com/notes',
      title: 'Notes',
      text: 'Release notes',
      look: 'extended',
      description: 'How we ship each week.',
      icon: 'example.com icon.png',
      image: 'example.com picture.png',
    });
  });

  it('keeps a card whose words hold escaped characters exactly as written', () => {
    const page = '<!-- bava: card -->\n[a \\[b\\]](<my file.pdf> "T")\n';
    expect(first('<!-- bava: card -->\n[a \\[b\\]](x.pdf)\n').type.name).toBe('card');
    same('<!-- bava: card -->\n[a \\[b\\]](x.pdf)\n');
    same(page);
  });

  it('keeps a card key on anything but a plain link alone on its line, as written', () => {
    for (const page of [
      '<!-- bava: card -->\nSee [a](a.pdf).\n',
      '<!-- bava: card -->\n[a](a.pdf) [b](b.pdf)\n',
      '<!-- bava: card -->\n[a\nb](a.pdf)\n',
      '<!-- bava: card -->\n[x][r]\n\n[r]: a.pdf\n',
      '<!-- bava: card -->\n<https://example.com>\n',
      '<!-- bava: card=huge -->\n[a](a.pdf)\n',
    ]) {
      expect(keepsMeaning(page), page).toContain('<!-- bava: card');
      expect(first(page).type.name, page).not.toBe('card');
    }
  });

  it("keeps a card's icon that is not a plain file name as written, never as its icon", () => {
    const page = '<!-- bava: card icon="../x.png" -->\n[a](a.pdf)\n';
    same(page);
    expect(first(page).attrs).toMatchObject({ icon: null, extra: 'icon="../x.png"' });
  });

  it('writes a new card from its address and words', () => {
    const n = schema.nodes;
    const doc = n.doc.create(null, [n.card.create({ href: 'my%20file.pdf', text: 'my [file]', look: 'extended' })]);
    const written = writePage(doc, parsePage('').front);
    expect(written).toBe('<!-- bava: card=extended -->\n[my \\[file\\]](my%20file.pdf)\n');
    expect(parsePage(written).doc.firstChild!.attrs).toMatchObject({ href: 'my%20file.pdf', text: 'my [file]', look: 'extended' });
  });
});
