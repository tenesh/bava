# designs

The generators of the Bava Design System: they read the app's tokens, fonts
and component styles and write the design system's files. No design files
live here; the screens and cards are in the design system and mockup
artifacts (`docs/design.md`).

- `npm run design` in `frontend/` writes `designs/out/project/`:
  `tokens.json`, `tokens.css`, `components/bundle.css` and the fonts.
- `tokens.ts` turns the compiled stylesheet into tokens; `bundle.ts` nests
  each component's styles under its `bv-<component>` class. Their tests sit
  beside them and run with `npm test`.
