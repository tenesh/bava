/**
 * The search palette's state: what is typed, what was found, and the row
 * Enter would open. Go is asked once typing has paused, each request
 * numbered, so an answer to an older query arriving late is dropped rather
 * than shown over the newer one.
 */
import { DEBOUNCE_MS } from '../ipc/render.svelte';
import type { SearchHit, SearchOpenPage } from './space.svelte';

export type SearchDeps = {
  search(query: string, open: SearchOpenPage): Promise<{ hits: SearchHit[]; more: boolean } | null>;
  /** The open page as the window holds it now, unsaved words included. */
  open(): SearchOpenPage;
  debounceMs?: number;
};

export function createSearch(deps: SearchDeps) {
  const wait = deps.debounceMs ?? DEBOUNCE_MS;
  let query = $state('');
  let hits = $state<SearchHit[]>([]);
  let more = $state(false);
  let failed = $state(false);
  let highlighted = $state(0);
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function show(next: SearchHit[], nextMore: boolean, didFail: boolean) {
    hits = next;
    more = nextMore;
    failed = didFail;
    highlighted = 0;
  }

  async function ask(text: string, id: number) {
    const answer = await deps.search(text, deps.open()).catch(() => null);
    if (id !== latest) return;
    if (answer) show(answer.hits, answer.more, false);
    else show([], false, true);
  }

  return {
    get query() {
      return query;
    },
    get hits() {
      return hits;
    },
    get more() {
      return more;
    },
    get failed() {
      return failed;
    },
    get highlighted() {
      return highlighted;
    },

    /** What is typed: asked after a pause; an empty query clears at once. */
    setQuery(text: string) {
      query = text;
      clearTimeout(timer);
      const id = ++latest;
      if (text.trim() === '') {
        show([], false, false);
        return;
      }
      timer = setTimeout(() => void ask(text, id), wait);
    },

    /** Move the highlighted row, stopping at the first and the last. */
    move(by: number) {
      if (hits.length === 0) return;
      highlighted = Math.min(hits.length - 1, Math.max(0, highlighted + by));
    },

    /** The palette closed: forget the search, and any answer still coming. */
    reset() {
      clearTimeout(timer);
      latest += 1;
      query = '';
      show([], false, false);
    },
  };
}

export type Search = ReturnType<typeof createSearch>;
