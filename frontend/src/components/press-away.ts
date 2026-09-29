/**
 * Closing a floating piece of UI when the pointer goes down anywhere else
 * (outside every element `inside` gives: itself, and what counts with it),
 * as every menu, picker, field and card in Bava does. Listened for in the
 * capture phase, so nothing under the pointer can stop it first.
 *
 * Returns the function that stops listening, for an `$effect` to return.
 */
export function pressAway(inside: () => Element | null | undefined | (Element | null | undefined)[], away: () => void): () => void {
  const press = (event: PointerEvent) => {
    const els = [inside()].flat().filter((el): el is Element => Boolean(el));
    if (els.length > 0 && !els.some((el) => el.contains(event.target as Node))) away();
  };
  document.addEventListener('pointerdown', press, true);
  return () => document.removeEventListener('pointerdown', press, true);
}
