# Design

Two private artifacts hold Bava's look, outside the repository; the
maintainer keeps their links:

- **Bava Design System**: tokens in both themes, the fonts, the mark, and a card per component, all
  taken from the app's own code: `frontend/src/styles/` for the tokens and
  shared styles, each component's styles for its card. Components are the
  app's CSS, each nested under a `bv-<component>` class.
- **Bava Mockup**: every screen as a 1280 × 800 window, by area, in either theme, drawn from
  the design system.

## The rule

New or changed UI is drawn first: a new component or token goes into the
design system, a new or changed screen into the mockup, and the user sees
them before the plan is written. The code stays the truth: where a mockup
and the app differ after a change ships, the mockup is updated to match.

## Keeping them current

A change to the tokens or to a component's styles is carried to the design
system, and the canvas's copy of it updated, in the same piece of work:
`npm run design` in `frontend/` rebuilds the design system's tokens,
stylesheet and fonts from the code into `designs/out/` (see `designs/`), to
be published from there. The
visual references in `testdata/visual/` are the pictures to check a card or a
board against.
