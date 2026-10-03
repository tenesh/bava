/**
 * Whether focus in a group of choices came from a pointer press or from the
 * keyboard, for the focus ring.
 *
 * Ark marks a choice `data-focus-visible` on a pointer press as well as from
 * the keyboard, and the browser's own `:focus-visible` is lost when Ark moves
 * focus along the group with the arrow keys. So the group remembers which
 * came last: a press hides the ring, a key shows it again.
 */
export function createPressModality() {
  let byPointer = $state(false);
  return {
    /** The last press or key on the group was a pointer's. */
    get byPointer() {
      return byPointer;
    },
    onpointerdown: () => {
      byPointer = true;
    },
    onkeydown: () => {
      byPointer = false;
    },
  };
}
