/**
 * Heading anchors as GitHub makes them, so a link to `page.md#goals` written
 * by Bava works on GitHub too: lower case, spaces as hyphens, everything but
 * letters, marks, digits, `-` and `_` dropped, and a repeat numbered `-1`,
 * `-2`, in page order.
 */
export function slugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = text
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
      .replace(/ /g, '-');
    let slug = base;
    let count = seen.get(base) ?? 0;
    while (seen.has(slug)) {
      count += 1;
      slug = `${base}-${count}`;
    }
    seen.set(base, count);
    seen.set(slug, 0);
    return slug;
  };
}
