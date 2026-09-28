import { describe, expect, it } from 'vitest';
import cases from '../../../testdata/links/pages.json';
import { pageLinks, parsePage } from './markdown';
import { backlinks, linksTo, onlyLinksChanged, relinkEdits, rewritePageLinks } from './page-links';
import { linkTo, resolveLink } from './links';

/** The addresses of the links the Document shows, in order. */
function shown(markdown: string): string[] {
  const out: string[] = [];
  parsePage(markdown).doc.descendants((node) => {
    for (const mark of node.marks) if (mark.type.name === 'link') out.push(mark.attrs.href as string);
    if (node.type.name === 'image' || node.type.name === 'video') out.push(node.attrs.src as string);
    if (node.type.name === 'card') out.push(node.attrs.href as string);
  });
  return out;
}

describe("where a page's links are", () => {
  for (const c of cases) {
    it(c.name, () => {
      const links = pageLinks(c.src);
      // Every link the Document shows is found, placed in the page's text.
      expect(links.map((l) => (l.dest ? c.src.slice(l.dest[0], l.dest[1]) : null)), 'found').toEqual(c.links);
      // Adjacent runs of one link are one mark in the Document, so compare the addresses found.
      expect([...new Set(links.map((l) => l.href))].sort(), 'as the Document reads them').toEqual([...new Set(shown(c.src))].sort());
    });
  }
});

describe('rewriting a page after a rename', () => {
  const moves = [{ from: 'Marketing/Launch plan.md', to: 'Marketing/Q4 launch.md' }];

  it('changes only the links to what moved, and their words where they are the old name', () => {
    const src = [
      '---',
      'tags: [a]',
      '---',
      '# Roadmap',
      '',
      'See [Launch plan](Marketing/Launch%20plan.md), [the plan](<Marketing/Launch plan.md> "Plan")',
      'and [Other](Other.md).',
      '',
      '```',
      '[Launch plan](Marketing/Launch%20plan.md)',
      '```',
      '',
      '<table>',
      '<tr><th>Who</th></tr>',
      '<tr><td><a href="Marketing/Launch%20plan.md">Launch plan</a></td></tr>',
      '</table>',
      '',
    ].join('\n');
    const want = src
      .replace('[Launch plan](Marketing/Launch%20plan.md),', '[Q4 launch](Marketing/Q4%20launch.md),')
      .replace('(<Marketing/Launch plan.md> "Plan")', '(<Marketing/Q4%20launch.md> "Plan")')
      .replace('<a href="Marketing/Launch%20plan.md">Launch plan</a>', '<a href="Marketing/Q4%20launch.md">Q4 launch</a>');
    expect(rewritePageLinks('Roadmap.md', src, moves)).toEqual({ text: want, unplaced: 0 });
  });

  it('rewrites a reference link at its definition', () => {
    const src = 'See [the plan][p].\n\n[p]: Marketing/Launch%20plan.md\n';
    expect(rewritePageLinks('Roadmap.md', src, moves)?.text).toBe('See [the plan][p].\n\n[p]: Marketing/Q4%20launch.md\n');
  });

  it('escapes the new words as the page holds them', () => {
    const star = [{ from: 'Q1.md', to: 'Q*1|x.md' }];
    expect(rewritePageLinks('R.md', '[Q1](Q1.md)\n', star)?.text).toBe('[Q\\*1|x](Q*1%7Cx.md)\n');
    // In a table's cell a `|` would end the cell: escaped in the words, encoded in the address.
    expect(rewritePageLinks('R.md', '| A |\n|---|\n| [Q1](Q1.md) |\n', star)?.text).toBe('| A |\n|---|\n| [Q\\*1\\|x](Q*1%7Cx.md) |\n');
    const money = [{ from: 'Q.md', to: '$x$ [^1].md' }];
    const table = '<table>\n<tr><th>A</th></tr>\n<tr><td><a href="Q.md">Q</a></td></tr>\n</table>\n';
    expect(rewritePageLinks('R.md', table, money)?.text).toBe(table.replace('<a href="Q.md">Q</a>', '<a href="$x$%20[^1].md">&#36;x&#36; &#91;^1]</a>'));
  });

  it('keeps CRLF line endings and every other byte', () => {
    const src = '# A\r\n\r\n- [Launch plan](Marketing/Launch%20plan.md) and `[x](Marketing/Launch%20plan.md)`  \r\n';
    expect(rewritePageLinks('Roadmap.md', src, moves)?.text).toBe(src.replace('[Launch plan](Marketing/Launch%20plan.md)', '[Q4 launch](Marketing/Q4%20launch.md)'));
  });

  it('returns nothing for a page with no link to what moved', () => {
    expect(rewritePageLinks('Roadmap.md', 'See [Other](Other.md).\n', moves)).toBeNull();
  });

  it('in every shared case, changes each address that moved and not one byte else', () => {
    // Into a folder: every address changes, never the words.
    const moved = [{ from: 'old.md', to: 'Archive/old.md' }];
    for (const c of cases) {
      const reaching = pageLinks(c.src).filter((l) => resolveLink('page.md', l.href)?.target === 'old.md');
      const ranges = new Map<number, { end: number; with: string }>();
      for (const l of reaching) {
        const anchor = resolveLink('page.md', l.href)!.anchor;
        ranges.set(l.dest![0], { end: l.dest![1], with: linkTo('page.md', 'Archive/old.md', anchor) });
      }
      let want = c.src;
      for (const [start, r] of [...ranges].sort((a, b) => b[0] - a[0])) want = want.slice(0, start) + r.with + want.slice(r.end);
      const got = rewritePageLinks('page.md', c.src, moved);
      expect(got?.text ?? c.src, c.name).toBe(want);
      expect(got?.unplaced ?? 0, c.name).toBe(0);
    }
  });
});

describe('what links to a page', () => {
  it('is any link the Document reads, never text that looks like one', () => {
    expect(linksTo('Roadmap.md', 'See [the plan](Marketing/Launch%20plan.md).\n', 'Marketing/Launch plan.md')).toBe(true);
    expect(linksTo('Roadmap.md', '`[the plan](Marketing/Launch%20plan.md)`\n', 'Marketing/Launch plan.md')).toBe(false);
    expect(linksTo('Roadmap.md', '$$\n[a](Marketing/Launch%20plan.md)\n$$\n', 'Marketing/Launch plan.md')).toBe(false);
  });
});

describe('the pages a rename rewrites', () => {
  const pages = [
    { name: 'Roadmap', path: 'Roadmap.md', text: '[Launch plan](Marketing/Launch%20plan.md)\n' },
    { name: 'Open', path: 'Open.md', text: '[Launch plan](Marketing/Launch%20plan.md)\n' },
    { name: 'Brief', path: 'Archive/Marketing/Brief.md', text: '[Roadmap](../Roadmap.md)\n' },
    { name: 'Other', path: 'Other.md', text: '[Other](Other.md)\n' },
  ];

  it('are every page reaching what moved, read from where it was, never the open page', () => {
    const moves = [
      { from: 'Marketing/Launch plan.md', to: 'Marketing/Q4 launch.md' },
      { from: 'Marketing/Brief.md', to: 'Archive/Marketing/Brief.md' },
    ];
    expect(relinkEdits(pages, moves, 'Open.md')).toEqual({
      edits: [
        { path: 'Roadmap.md', before: pages[0].text, after: '[Q4 launch](Marketing/Q4%20launch.md)\n' },
        { path: 'Archive/Marketing/Brief.md', before: pages[2].text, after: '[Roadmap](../../Roadmap.md)\n' },
      ],
      unplaced: [],
    });
  });
});

describe('what links to a page, across the Space', () => {
  it('lists each page whose links reach it, never the page itself', () => {
    const pages = [
      { name: 'A', path: 'A.md', text: '[B](B.md) and [B again](B.md#x)\n' },
      { name: 'B', path: 'B.md', text: '[Me](#top) [Me](B.md)\n' },
      { name: 'C', path: 'C.md', text: '`[B](B.md)`\n' },
    ];
    expect(backlinks(pages, 'B.md').map((p) => p.path)).toEqual(['A.md']);
  });
});

describe('links the review placed wrongly', () => {
  const zed = [{ from: 'b.md', to: 'Zed.md' }];
  const rename = (src: string) => rewritePageLinks('r.md', src, zed);

  it('leaves a definition running over two quoted lines as it was, and counts it', () => {
    const src = '[x][q]\n\n> [q]:\n> b.md\n';
    expect(rename(src)).toEqual({ text: src, unplaced: 1 });
  });

  it("finds a table cell by the row's own split, never inside an earlier cell's code, comment or equation", () => {
    for (const first of ['`a \\| [x](b.md)`', '<!-- \\| [x](b.md) -->', '$a \\| [x](b.md)$']) {
      const src = `| h | i |\n|---|---|\n| ${first} | [x](b.md) |\n`;
      expect(rename(src)?.text, first).toBe(`| h | i |\n|---|---|\n| ${first} | [x](Zed.md) |\n`);
    }
  });

  it("reads an HTML table's links with the table's own reader", () => {
    const upper = '<table>\n<tr><th>A</th><th>B</th></tr>\n<tr><td><a href="b.md">b</A></td><td><a href="c.md">c</a></td></tr>\n</table>\n';
    expect(rename(upper)?.text).toBe(upper.replace('<a href="b.md">b</A>', '<a href="Zed.md">Zed</A>'));
    const titled = '<table>\n<tr><th>A</th></tr>\n<tr><td><a title="see href=" href="b.md">b</a></td></tr>\n</table>\n';
    expect(rename(titled)?.text).toBe(titled.replace('href="b.md">b<', 'href="Zed.md">Zed<'));
  });
});

describe('a rewrite is checked by reading the page again', () => {
  const moves = [{ from: 'b.md', to: 'Zed.md' }];

  it('passes when only link addresses and words changed', () => {
    expect(onlyLinksChanged('r.md', 'See [b](b.md) and `c`.\n', 'See [Zed](Zed.md) and `c`.\n', moves)).toBe(true);
  });

  it('fails when anything else changed, or a link went somewhere else', () => {
    expect(onlyLinksChanged('r.md', 'See [b](b.md) and `c`.\n', 'See [Zed](Zed.md) and `d`.\n', moves)).toBe(false);
    expect(onlyLinksChanged('r.md', 'See [b](b.md).\n', 'See [b](Other.md).\n', moves)).toBe(false);
    expect(onlyLinksChanged('r.md', 'See [b](b.md).\n', 'See [b](Zed.md) [c](c.md).\n', moves)).toBe(false);
    expect(onlyLinksChanged('r.md', '---\na: 1\n---\n[b](b.md)\n', '---\na: 2\n---\n[b](Zed.md)\n', moves)).toBe(false);
  });
});

describe("the fourth review's inputs", () => {
  const zed = [{ from: 'b.md', to: 'Zed.md' }];
  const rename = (src: string) => rewritePageLinks('r.md', src, zed);

  it("never takes a quote marker for part of a definition's address", () => {
    for (const src of ['[x][q]\n\n>[q]:\n>b.md\n', '- [x][q]\n\n  > [q]:\n  >b.md\n  > more\n']) {
      expect(rename(src), src).toEqual({ text: src, unplaced: 1 });
    }
  });

  it('keeps the CR of a CRLF line after an address', () => {
    expect(rename('[x][q]\r\n\r\n[q]: b.md\r\n')?.text).toBe('[x][q]\r\n\r\n[q]: Zed.md\r\n');
    expect(rename('See [x](b.md)\r\n')?.text).toBe('See [x](Zed.md)\r\n');
  });

  it('keeps the angle brackets an address was written in', () => {
    expect(rename('[x](<b.md>)\n')?.text).toBe('[x](<Zed.md>)\n');
    expect(rename('[x][q]\n\n[q]: <b.md>\n')?.text).toBe('[x][q]\n\n[q]: <Zed.md>\n');
  });
});

describe('a label defined twice', () => {
  it('is placed at the definition the page uses, the first, or not at all', () => {
    const zed = [{ from: 'b.md', to: 'Zed.md' }];
    const unused = '[x][q]\n\n[q]:\nb.md\n\n[q]: b.md\n';
    expect(pageLinks(unused)[0].dest).toBeNull();
    expect(rewritePageLinks('r.md', unused, zed)).toEqual({ text: unused, unplaced: 1 });
    const used = '[x][q]\n\n[q]: b.md\n\n[q]: other.md\n';
    expect(rewritePageLinks('r.md', used, zed)?.text).toBe('[x][q]\n\n[q]: Zed.md\n\n[q]: other.md\n');
  });
});

describe('images and videos after a rename', () => {
  it('follow a page that moved, and never change their words', () => {
    const text = '<!-- bava: width=small -->\n![Logo](../.bava/attachments/logo.png)\n\nSee ![inline](../x.png).\n';
    const got = rewritePageLinks('Notes/Page.md', text, [{ from: 'Notes/Page.md', to: 'Page.md' }]);
    expect(got).toEqual({ text: '<!-- bava: width=small -->\n![Logo](.bava/attachments/logo.png)\n\nSee ![inline](../x.png).\n', unplaced: 0 });
  });

  it('follow an attachment renamed, its address and every poster naming it', () => {
    const text = '<!-- bava: caption="poster=logo.png" poster="logo.png" loop -->\n![Demo](.bava/attachments/demo.mp4)\n\n![Logo](.bava/attachments/logo.png)\n';
    const got = rewritePageLinks('Page.md', text, [{ from: '.bava/attachments/logo.png', to: '.bava/attachments/brand mark.png' }]);
    expect(got).toEqual({
      text: '<!-- bava: caption="poster=logo.png" poster="brand mark.png" loop -->\n![Demo](.bava/attachments/demo.mp4)\n\n![Logo](.bava/attachments/brand%20mark.png)\n',
      unplaced: 0,
    });
  });

  it('keep a poster written without quotes that way', () => {
    const text = '<!-- bava: poster=logo.png -->\n![Demo](.bava/attachments/demo.mp4)\n';
    expect(rewritePageLinks('Page.md', text, [{ from: '.bava/attachments/logo.png', to: '.bava/attachments/brand.png' }])?.text).toBe(
      '<!-- bava: poster=brand.png -->\n![Demo](.bava/attachments/demo.mp4)\n',
    );
    // A new name that needs quotes gets them.
    expect(rewritePageLinks('Page.md', text, [{ from: '.bava/attachments/logo.png', to: '.bava/attachments/brand mark.png' }])?.text).toBe(
      '<!-- bava: poster="brand mark.png" -->\n![Demo](.bava/attachments/demo.mp4)\n',
    );
  });

  it('leave a page with no image of what moved alone', () => {
    expect(rewritePageLinks('Page.md', '<!-- bava: poster="a.png" -->\n![v](.bava/attachments/v.mp4)\n', [{ from: '.bava/attachments/b.png', to: '.bava/attachments/c.png' }])).toBeNull();
  });

  it('are what the read-back check allows to change, and nothing else about them', () => {
    const moves = [{ from: '.bava/attachments/a.png', to: '.bava/attachments/b.png' }];
    const before = '<!-- bava: width=small -->\n![A](.bava/attachments/a.png)\n';
    expect(onlyLinksChanged('Page.md', before, '<!-- bava: width=small -->\n![A](.bava/attachments/b.png)\n', moves)).toBe(true);
    expect(onlyLinksChanged('Page.md', before, '<!-- bava: width=large -->\n![A](.bava/attachments/b.png)\n', moves)).toBe(false);
    expect(onlyLinksChanged('Page.md', before, '<!-- bava: width=small -->\n![B](.bava/attachments/b.png)\n', moves)).toBe(false);
  });
});

describe('cards after a rename', () => {
  it('follow a page or file that moved, and their words where they are its old name', () => {
    const text = '<!-- bava: card -->\n[Launch plan](Marketing/Launch%20plan.md)\n';
    expect(rewritePageLinks('Roadmap.md', text, [{ from: 'Marketing/Launch plan.md', to: 'Marketing/Q4 launch.md' }])?.text).toBe(
      '<!-- bava: card -->\n[Q4 launch](Marketing/Q4%20launch.md)\n',
    );
  });

  it('follow an attachment renamed, in their icon and picture', () => {
    const text = '<!-- bava: card=extended icon="a.png" image=a.png -->\n[Site](https://example.com)\n';
    expect(rewritePageLinks('Page.md', text, [{ from: '.bava/attachments/a.png', to: '.bava/attachments/b.png' }])?.text).toBe(
      '<!-- bava: card=extended icon="b.png" image=b.png -->\n[Site](https://example.com)\n',
    );
  });
});
