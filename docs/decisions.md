# Decisions

Dated rows, newest last. A row belongs here when it closes a question that
could reasonably have gone another way.

| Date | Decision | Why |
|---|---|---|
| 2026-09-16 | `nodeMap` is keyed by SVG element id, valued by source span | One structure serves both directions. Click-on-node is a direct lookup; diagnostic-to-shape is a reverse scan, cheap at the sizes this canvas supports. Two maps would be faster one way and a synchronisation risk both ways. |
| 2026-09-16 | ~~Positions cross the boundary as byte offsets plus 1-indexed lines~~ **superseded same day** | Kept as a record: the reasoning was right about converting once in Go, and wrong about the unit. See the UTF-16 row below. |
| 2026-09-16 | `OmitVersion` is set on every render | Measured: D2 emits `data-d2-version="v0.8.1-HEAD"` while running v0.9.0. A golden must not record a version string that is false. |
| 2026-09-16 | `NoXMLTag` is set on every render | The canvas injects the SVG into a div it owns; an XML declaration is invalid in that position. |
| 2026-09-16 | Golden SVGs are compared byte-for-byte with no normalisation | Measured stable across three processes and three in-process calls, with and without a salt: ids derive from content, and TALA's seeds are fixed. A scrubbing step would only hide real regressions. |
| 2026-09-16 | An unknown layout engine is an error, never a fallback to TALA | dagre and elk are alternatives, not fallbacks. A typo that silently changed layout engine would not be noticed for a long time. |
| 2026-09-16 | No `internal/compile/` package | `d2lib.Compile` fuses parse, compile and layout, so the package would be an empty shell wrapping one call. The glob stays registered in `.ai/rules/index.md`, unused, until there is something real for it. |
| 2026-09-16 | Milestone 1 ships no D2 language mode | Highlighting is a tokeniser plus tests, and it competes with getting debounce, staleness and goldens right. Scheduled as Milestone 3.5, before Milestone 5 embeds editors in documents. |
| 2026-09-16 | Positions cross the boundary as UTF-16 code units, via `CompileOptions.UTF16Pos` | Supersedes the row above it. D2 reports UTF-8 bytes; JavaScript indexes UTF-16. Measured: in `café: Café\nweb: Web`, `web` is at byte 13 and UTF-16 index 11, so every marker and jump landed two characters out on any non-ASCII source. An all-ASCII test suite never sees it. |
| 2026-09-16 | The canvas may inject render output with `innerHTML` at D2 v0.9.0 | Probed the actual vectors: `\|html\|` blocks render as syntax-highlighted `<tspan>` text, markdown labels reject HTML elements outright ("native Markdown SVG does not support HTML element `<span>`"), and no `foreignObject`, live handler attribute or `javascript:` URL appears in output. **Re-probe on any D2 bump** — this is a property of v0.9.0, not a guarantee. |
| 2026-09-16 | `@wailsio/runtime` is pinned exactly, matching the Go tag | It floated on `latest` and had resolved to `beta.21` against a Go side pinned to `beta.20`. `.ai/rules/wails.md` forbids floating a version whose betas are near-nightly. |
