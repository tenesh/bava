/**
 * Where an element sits once the page's fonts have loaded, in whole pixels,
 * so a floating piece placed from it lands on the same pixel every run.
 */
export async function settledBox(element: HTMLElement): Promise<{ left: number; top: number; bottom: number }> {
  await document.fonts.ready;
  const box = element.getBoundingClientRect();
  return { left: Math.round(box.left), top: Math.round(box.top), bottom: Math.round(box.bottom) };
}
