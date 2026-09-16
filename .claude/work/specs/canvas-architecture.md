# Canvas architecture

Decided 2026-09-16. This supersedes the "source pane → Go compile → SVG
display" architecture that Milestone 1 was built against. Milestone 1's
pipeline survives, in a narrower role.

## The product

A free-placement canvas — place, draw and connect anything, anywhere — on
which one kind of element renders itself from code. Not a layout-engine tool
with a visual skin, and not a whiteboard with no structure. Both, with a
defined seam between them.

## The element model

```
File
├── document        prose, optional
└── canvas          a scene; every element carries x, y, w, h, z
    ├── shape       rectangle, ellipse, diamond, line
    ├── text        free text, unattached
    ├── stroke      freehand pen, a point list
    ├── arrow       see Bindings below
    ├── frame       device frames and layout frames
    ├── group       labelled, first-class, nestable
    ├── icon        bundled or user-imported SVG
    ├── image       embedded raster
    └── diagram     owns D2 source; renders itself; see below
```

The user switches between `Document | Both | Canvas`. One file, three views.

## The diagram element

A `diagram` element holds D2 source inline and is rendered by
`internal/render` — the Milestone 1 pipeline, unchanged in shape:

```
Render(source, opts) -> { svg, errors, nodeMap }
```

It is placed, moved, resized and z-ordered like any other element. Inside its
bounds, the layout engine decides where nodes go; outside, the user decides
where the element goes. That is the whole seam.

**Source is inline, not referenced.** A canvas can hold several diagrams;
referencing would scatter a sidecar `.d2` per diagram per canvas, and the
binding model below assumes the diagram is an object in the same file.

## Bindings — the hard part

An arrow may bind to a whole element, or **into a diagram's interior**:

```
arrow {
  from: { element: "shape-7" }
  to:   { element: "diagram-1", node: "vector-db", side: "left" }
}
```

This works because of two properties, one of which already exists:

**Identity.** `nodeMap` keys are D2's absolute ids (`web.api`, `db`), derived
from the source rather than from geometry. Re-layout does not change them. That
is the anchor a binding needs, and Milestone 1 already returns it.

**Geometry.** `nodeMap` must additionally carry each node's rect in
diagram-local coordinates. D2 already exposes it — `diagram.Shapes[]` carries
`Pos`, `Width`, `Height`. **Add these fields before the canvas is built on top
of the contract, not after**: `ipc.md` warned that retrofitting `nodeMap` meant
touching the whole pipeline, and this is the same lesson arriving a second
time.

An endpoint resolves as: node rect in diagram-local space, transformed by the
diagram element's own position and scale, in scene space.

**Re-anchoring.** Every render recomputes bound endpoints. With the 250ms
debounce, an arrow attached to a node visibly follows as the D2 is edited.
That behaviour is what makes the hybrid feel like one tool rather than two
modes sharing a window.

**Dangling bindings.** Renaming or deleting a node breaks its binding — and
semantically it *is* a different node. Defined behaviour: the arrow remains,
its endpoint freezes at the last known position, and it is marked detached.
Never silently delete something the user drew.

## Rendering and hit-testing

The scene is a Konva stage. The diagram element is rasterised into it, not kept
as live SVG DOM: mixing a DOM layer into a canvas stage complicates z-order and
transforms, and the node bounds give hit-testing everything it needs. A click
inside a diagram resolves against the bounds index to a node id, which is the
same key used for bindings and for jump-to-source.

## What moves, and what stays

| | Before | Now |
|---|---|---|
| Layout of a whole drawing | Go, via a layout engine | The user |
| Layout inside a diagram element | Go, via TALA | Unchanged |
| Rendering the scene | Go produced one SVG | Frontend, Konva |
| Rendering a diagram element | Go | Unchanged |
| Text measurement | All in Go | D2 text still in Go; canvas text in the frontend |

**Canvas text measurement moves to the frontend**, which narrows a rule that
was previously absolute. The reason the rule existed does not go away —
WebKitGTK and WebView2 disagree on glyph advances — so the mitigation is:
fonts are bundled (Geist, done), and **measured text dimensions are stored in
the file**, so a scene reopens identically on another platform rather than
being re-measured. D2 diagram text is unaffected: it is measured in Go as
before.

## Foundation

**Konva** (MIT) for the scene graph, hit-testing and transform handles.
Supporting: `perfect-freehand` (MIT) for pen strokes, `perfect-arrows` (MIT)
for arrow geometry, `@dagrejs/dagre` (MIT) for optional auto-arrange, `rbush`
(MIT) for spatial indexing when element counts climb, `roughjs` (MIT) if a
hand-drawn style is wanted.

Rejected: **tldraw**, whose licence is not a standard open-source licence;
**elkjs**, EPL-2.0/GPL where dagre is MIT and does the same job; embedding
**Excalidraw**, which is MIT but would put React inside a Svelte app.

## What Bava will not have

Real-time collaboration, shareable canvas links, and third-party integrations
(Confluence, Notion, GitHub) all require a backend. They are ruled out by the
first non-negotiable, not by effort. Comments exist as local annotations.
