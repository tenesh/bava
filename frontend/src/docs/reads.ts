/**
 * Reads of the Space's pages, and of what links to a page, numbered so an
 * answer overtaken by a later read is dropped. A read of the pages alone
 * (for the `@` menu) never overtakes one of "Linked from".
 */
export function latestReads() {
  let pages = 0;
  let all = 0;
  return {
    start(withBacklinks: boolean) {
      const pagesId = (pages += 1);
      const allId = withBacklinks ? (all += 1) : -1;
      return {
        pagesCurrent: () => pagesId === pages,
        backlinksCurrent: () => allId === all,
      };
    },
  };
}
