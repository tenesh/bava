import { describe, expect, it } from 'vitest';
import cases from '../../../testdata/fixtures/links/paths.json';
import { linkTo, resolveLink, retarget } from './links';

describe('the link rules', () => {
  it('finds the page a link reaches', () => {
    for (const c of cases.resolve) {
      const got = resolveLink(c.page, c.dest);
      if (c.target === '') expect(got, `${c.page} → ${c.dest}`).toBeNull();
      else expect(got, `${c.page} → ${c.dest}`).toEqual({ target: c.target, anchor: c.anchor });
    }
  });

  it('writes a relative, encoded path', () => {
    for (const c of cases.linkTo) expect(linkTo(c.from, c.target, c.anchor), `${c.from} → ${c.target}`).toBe(c.want);
  });

  it('follows moves and keeps reworded text', () => {
    for (const c of cases.retarget) {
      const got = retarget(c.page, c.href, c.text, c.moves);
      if (c.href2 === '') expect(got, c.name).toBeNull();
      else expect(got, c.name).toEqual({ href: c.href2, text: c.text2 });
    }
  });
});
