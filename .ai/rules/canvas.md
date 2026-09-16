# Canvas

## The canvas is not a Svelte component
It is a plain TypeScript class, mounted once into a `<div>` via a ref, that
owns its own DOM and patches itself. Svelte never renders diagram nodes.

This is a performance constraint, not a style preference. A diagram rendered
as per-node Svelte components means every pan, zoom, or keystroke in the
source pane triggers reconciliation over the whole tree, and the app stutters
at a few hundred nodes. When that happens the instinct is to blame the
webview; it is this.

Svelte hands the canvas a render result; the canvas diffs and patches. Data
flows in, events flow out. No reactive state holds geometry.

## All text measurement happens in Go
`textmeasure` computes node dimensions before layout. Never measure text in
the webview — WebKitGTK and WebView2 disagree on glyph advances, so the same
label yields different box widths, and the layout engine then produces a
*different graph*, not just a differently-rendered one.

The rule extends to fonts: bundle them, reference via `@font-face`, never rely
on a system font being present.

## Stale responses must be dropped
Render requests are debounced 250ms and tagged with an incrementing ID.
Responses whose ID is not the latest are discarded. Without this, a slow TALA
render can land after a faster subsequent one and the diagram flickers between
states — a symptom that looks like a layout bug and is not.

## An open modal disables canvas pointer events
Ark's modal Dialog sets `pointer-events: none` on `body` while open. Measured
in the Wails webview on 2026-09-16: with a dialog open, `body` and every
element outside the dialog computed to `pointer-events: none`, and
`document.elementFromPoint` skipped them entirely.

This affects the running app, not just tests. Panning, selection and
hit-testing stop working for as long as a modal is up. If pointer handling
appears to break for no reason, check whether a modal is open before
investigating the canvas.

It also makes naive assertions lie: a hit-test that "proves" the canvas is
unreachable, or that something is on top, may be measuring the modal's
pointer-events override rather than stacking or geometry. Override the
property before asserting, or assert on rects instead.

## Scaling limit
Past roughly 1–2k SVG elements, hit-testing and panning degrade in any engine.
That is the point to move to canvas or WebGL rendering, not before. Do not
pre-optimise for it.