# Diagrams become free shapes: decisions

Opened 2026-09-17. Changes the diagram model in
`.claude/work/specs/canvas-architecture.md`, and with it Milestones 6 and 7,
`docs/file-format.md` and `docs/ipc.md`. Those are rewritten once the open
questions below are answered; until then this file is the record.

## What was decided

### A generated diagram becomes ordinary canvas elements (2026-09-17)
The user's words: "when i ask the AI to generate, it generates on the canvas
and then i can freely move and edit the diagram on canvas like how i can
freely add any shapes". Evidence: the Eraser reference screenshots, where a
container inside a generated diagram is selected with its own handles.

So a diagram is not a live block rendered from D2 whose interior the layout
engine owns. D2 produces the diagram once: the source is compiled, laid out,
and converted into shapes, text, arrows and groups. From then on every box can
be moved, restyled, deleted, and connected to, like anything drawn by hand.

### The D2 source is discarded after conversion (2026-09-17)
Asked and answered. The shapes are the diagram from then on, saved as
ordinary canvas elements. No second copy exists that can disagree with what is
on screen. To change the whole diagram, ask the AI again or edit by hand.

Rejected: keeping the code read-only (stale after the first edit), and keeping
it with a "re-layout from code" action (two sources of truth, and re-layout
throws away manual moves).

### Editing happens on the canvas (2026-09-17)
The document can embed a selection of the canvas, as an inline link or
rendered in place. Editing an embed moves focus to the canvas with those
elements selected; there is no separate editing surface in the document.

## What this retires, pending the rewrite

- The `diagram` element type with inline D2 source and a `block` reference.
- Fenced `d2` blocks as the storage for canvas diagrams.
- Bindings into a diagram's interior by D2 node id: a node is now an ordinary
  element with its own element id, so a binding is element-to-element.
- A per-diagram code editor and live re-render on edit.

What survives: D2 as the generator (the AI writes D2 because it compiles and
can be checked, and the compile-and-repair loop still holds), the layout
engines, and `Render`'s geometry, which now feeds conversion rather than a
bitmap.

### A person can make a diagram from D2 code, without the AI (2026-09-17)
Asked and answered. An "Insert ▸ Diagram from code" dialog takes typed or
pasted D2, previews it, and inserts it as free shapes. This is Milestone 6's
feature; the AI in Milestone 11 reuses the same conversion. Diagrams therefore
work with no AI provider configured.

### The canvas gets the shape set D2 and Eraser share (2026-09-17)
Asked and answered, after comparing D2 v0.9.0's shape list (`lib/shape`) with
Eraser's flowchart docs. Canvas shapes, drawable by hand and produced by
conversion:

rectangle, ellipse, diamond, cylinder, hexagon, parallelogram, document,
person, cloud.

D2's rarer shapes (queue, page, package, step, callout, stored data, C4
person) convert to a rectangle and keep their label. SQL table, UML class and
code blocks are deferred to a later milestone. Star, trapezoid and triangle
(Eraser only) are not in the set; D2 cannot produce them.

### Arrows stay attached to the shapes they connect, from Milestone 6 (2026-09-17)
Asked and answered. A converted diagram's edges become arrows attached to
their endpoint elements; moving a box moves and re-routes its arrows. Without
it the first move breaks a generated diagram. Element-to-element attachment
moves from Milestone 7 into Milestone 6; Milestone 7 keeps hand-drawn arrows
snapping to shapes and detached-arrow handling.

### Containers own their contents (2026-09-17)
Asked and answered. A D2 container converts to a labelled container element
that owns the elements inside it: dragging it moves them; dragging an element
out removes it; dropping one in adds it. Same model as a Figma frame. The
existing `frame` element is the natural home for this behaviour.

### Shapes have colours, from a palette (2026-09-17)
Asked and answered. Every shape has fill, border and text colour, chosen from a
fixed palette of named swatches that each resolve to a light and a dark value,
so a choice stays readable when the theme changes. The file stores the swatch
name, not a hex value. Conversion maps D2's colours to the nearest swatch; the
user can recolour anything. Arbitrary hex colours are deferred.

Consistent with the earlier decision that shape colours are scene data, not
design tokens: swatches are content the user picks, resolved per theme.

## Open questions: asked one at a time

2. (Milestone 8) What is "a selection of the canvas" in a document embed:
   the picked elements, or a region?
3. (Milestone 8) Is a rendered embed live or a snapshot?
4. (Milestone 8) What does an embed look like in a plain Markdown viewer?
5. (Milestone 8) What happens to an embed whose elements are deleted?
