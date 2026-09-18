/**
 * Rotation: the geometry of turning a selection, and of testing what is drawn
 * rather than what is stored.
 *
 * An element stores an `angle` in degrees clockwise about its own centre
 * (`docs/file-format.md`); its `x`, `y`, `w` and `h` stay the unrotated box.
 * Everything that has to know where the element actually is on screen, from
 * hit-testing to the marquee, goes through here.
 *
 * Pure functions over elements, so the parts easy to get subtly wrong (a group
 * orbiting its shared centre, a point read in an element's own frame) are
 * testable without a stage.
 */
import type { Box } from './selection';
import type { SceneElement } from './scene';
import { scaleInto, tidy } from './resize';
import { ANGLE_STEP } from './constrain';

export type Point = { x: number; y: number };

/** Shift snaps to `ANGLE_STEP` degrees, the same step a drawn line snaps to. */

/** An angle brought into 0 to 359, so a file never records 370 or -90. */
export function normalise(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** The nearest `step` degrees. */
export function snapDegrees(degrees: number, step: number = ANGLE_STEP): number {
  return normalise(Math.round(normalise(degrees) / step) * step);
}

/**
 * The direction of `point` from `centre`, in degrees clockwise from straight
 * up: the rotate handle sits above the selection, so up is where a rotation
 * reads as zero. The centre itself has no direction, and reads as zero.
 */
export function angleOf(centre: Point, point: Point): number {
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  if (dx === 0 && dy === 0) return 0;
  return normalise((Math.atan2(dx, -dy) * 180) / Math.PI);
}

/** `point` turned `degrees` clockwise about `centre`. */
export function rotatePoint(point: Point, centre: Point, degrees: number): Point {
  if (degrees === 0) return { x: point.x, y: point.y };
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  // Clockwise on screen, where y grows downward.
  return { x: centre.x + dx * cos - dy * sin, y: centre.y + dx * sin + dy * cos };
}

export function centreOf(box: Box): Point {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/** The angle an element is stored with, or zero. */
export function angleOfElement(element: { angle?: number }): number {
  return normalise(element.angle ?? 0);
}

/**
 * Whether an element may be rotated. An elbow arrow may not: it is drawn as
 * orthogonal segments, and a turned elbow is no longer an elbow.
 */
export function canRotate(element: { type: string; arrowType?: string }): boolean {
  return !(element.type === 'arrow' && element.arrowType === 'elbow');
}

/**
 * A selection turned `degrees` about `centre`: each element takes the angle on
 * top of the one it had, and its own centre orbits the shared one, so a group
 * turns as one object rather than each element spinning where it stands.
 * Elements that cannot rotate are returned untouched.
 */
export function rotateElements<T extends SceneElement>(elements: T[], centre: Point, degrees: number): T[] {
  return elements.map((element) => {
    const own = centreOf(element);
    const moved = rotatePoint(own, centre, degrees);
    // Every element orbits the shared centre, even one that cannot take an
    // angle: an elbow arrow joining two shapes has to travel with them.
    const turned = {
      ...element,
      x: tidy(moved.x - element.w / 2),
      y: tidy(moved.y - element.h / 2),
    } as T & { angle?: number };
    if (!canRotate(element as { type: string; arrowType?: string })) return turned;
    // Wrapped after rounding, never before: rounding a hair short of a full
    // turn wrote 360, outside the range the format documents.
    const angle = normalise(tidy(angleOfElement(element) + degrees));
    // Absent means upright, so an element brought back to zero carries nothing.
    if (angle === 0) delete turned.angle;
    else turned.angle = angle;
    return turned;
  });
}

/** An element's four drawn corners, in its stored order: TL, TR, BR, BL. */
export function cornersOf(element: SceneElement): Point[] {
  const centre = centreOf(element);
  const angle = angleOfElement(element);
  return [
    { x: element.x, y: element.y },
    { x: element.x + element.w, y: element.y },
    { x: element.x + element.w, y: element.y + element.h },
    { x: element.x, y: element.y + element.h },
  ].map((corner) => rotatePoint(corner, centre, angle));
}

/**
 * The axis-aligned box that holds an element as drawn: its own box when it is
 * upright, and the box around its turned corners when it is not. What the
 * marquee and the eraser test.
 */
export function rotatedBounds(element: SceneElement): Box {
  if (angleOfElement(element) === 0) return { x: element.x, y: element.y, w: element.w, h: element.h };
  const corners = cornersOf(element);
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * A point read in an element's own frame: where it would be if the element
 * were upright. How a rotated element is hit-tested, erased and resized
 * without every caller learning trigonometry.
 */
export function toLocal(point: Point, element: SceneElement): Point {
  return rotatePoint(point, centreOf(element), -angleOfElement(element));
}

/** Whether a point is inside an element as drawn, rotation included. */
export function containsPoint(element: SceneElement, point: Point): boolean {
  const local = toLocal(point, element);
  return (
    local.x >= element.x && local.x <= element.x + element.w && local.y >= element.y && local.y <= element.y + element.h
  );
}

/** A selection's box with the angle it is drawn at. */
export type Frame = Box & { angle: number };

/**
 * The frame the selection outline and its handles follow. One element keeps
 * its own box and angle, so the outline sits on the shape and a resize works
 * along its axes. Several elements get the upright box around everything as
 * drawn: a shared frame has no angle of its own.
 */
export function selectionFrame(elements: SceneElement[]): Frame {
  if (elements.length === 0) return { x: 0, y: 0, w: 0, h: 0, angle: 0 };
  if (elements.length === 1) {
    const [only] = elements;
    return { x: only.x, y: only.y, w: only.w, h: only.h, angle: angleOfElement(only) };
  }
  const boxes = elements.map(rotatedBounds);
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y, angle: 0 };
}

/** A point read in a frame's own space, so an upright test can be used. */
export function pointInFrame(point: Point, frame: Frame): Point {
  return frame.angle === 0 ? point : rotatePoint(point, centreOf(frame), -frame.angle);
}

/** A drag vector turned into a frame's own space. */
export function deltaInFrame(dx: number, dy: number, angle: number): Point {
  return angle === 0 ? { x: dx, y: dy } : rotatePoint({ x: dx, y: dy }, { x: 0, y: 0 }, -angle);
}

/**
 * A resized box put back where a rotated frame leaves it. Resizing happens in
 * the frame's own space, where the untouched edge stays put; on screen that
 * edge is rotated, so the box's centre has to move by the same shift, turned.
 */
export function placeResized(before: Box, after: Box, angle: number): Box {
  if (angle === 0) return after;
  const from = centreOf(before);
  const to = centreOf(after);
  const moved = rotatePoint({ x: to.x - from.x, y: to.y - from.y }, { x: 0, y: 0 }, angle);
  return { x: from.x + moved.x - after.w / 2, y: from.y + moved.y - after.h / 2, w: after.w, h: after.h };
}

/**
 * An element scaled from one selection frame into another, rotation included.
 *
 * A frame around several elements is the box around them as drawn, so a
 * rotated member cannot be scaled through its stored box: the stretch would
 * land on the wrong axis and push it outside the frame. Its centre moves with
 * the frame, and the frame's scale is resolved into the element's own axes,
 * which is exact at each quarter turn and for a uniform scale, and an even
 * spread of the stretch in between (a rectangle cannot shear and stay one).
 */
export function scaleRotatedInto<T extends SceneElement>(element: T, from: Box, to: Box): T {
  const angle = angleOfElement(element);
  if (angle === 0) return scaleInto(element as T & Box, from, to);
  const sx = from.w === 0 ? 1 : to.w / from.w;
  const sy = from.h === 0 ? 1 : to.h / from.h;
  const own = centreOf(element);
  const centre = { x: to.x + (own.x - from.x) * sx, y: to.y + (own.y - from.y) * sy };
  const radians = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const w = element.w * (cos * sx + sin * sy);
  const h = element.h * (sin * sx + cos * sy);
  const scaled = {
    ...element,
    x: tidy(centre.x - w / 2),
    y: tidy(centre.y - h / 2),
    w: tidy(w),
    h: tidy(h),
  };
  const points = (element as T & { points?: number[] }).points;
  if (points) {
    const fx = element.w === 0 ? 1 : w / element.w;
    const fy = element.h === 0 ? 1 : h / element.h;
    (scaled as T & { points?: number[] }).points = points.map((value, i) => tidy(value * (i % 2 === 0 ? fx : fy)));
  }
  return scaled;
}
