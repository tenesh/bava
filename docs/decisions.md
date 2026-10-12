# Decisions

Dated rows, newest last: each closes a question that could have gone another way.

| Date | Decision | Why |
|---|---|---|
| 2026-09-16 | `nodeMap` is keyed by SVG element id, valued by source span | One structure serves both lookup directions with nothing to keep in sync. |
| 2026-09-16 | ~~Positions cross the boundary as byte offsets plus 1-indexed lines~~ **superseded same day** | Replaced by UTF-16 code units (below). |
| 2026-09-16 | `OmitVersion` is set on every render | D2 emits a wrong version string, which a golden must not record. |
| 2026-09-16 | `NoXMLTag` is set on every render | An XML declaration is invalid inside the div the SVG is injected into. |
| 2026-09-16 | Golden SVGs are compared byte-for-byte with no normalisation | Output was measured stable across processes, so scrubbing would only hide regressions. |
| 2026-09-16 | An unknown layout engine is an error, never a fallback to TALA | A typo that silently changed engine would go unnoticed. |
| 2026-09-16 | No `internal/compile/` package | `d2lib.Compile` fuses parse, compile and layout, so the package would wrap one call. |
| 2026-09-16 | Milestone 1 ships no D2 language mode | Highlighting competed with getting debounce, staleness and goldens right; scheduled later. |
| 2026-09-16 | Positions cross the boundary as UTF-16 code units, via `CompileOptions.UTF16Pos` | D2 reports UTF-8 bytes and JavaScript indexes UTF-16, so markers landed wrong on non-ASCII source. |
| 2026-09-16 | The canvas may inject render output with `innerHTML` at D2 v0.9.0 | Probed: no HTML, `foreignObject`, handlers or `javascript:` URLs reach the output. **Re-probe on any D2 bump.** |
| 2026-09-16 | `@wailsio/runtime` is pinned exactly, matching the Go tag | A floating version had drifted a beta ahead of the Go side. |
| 2026-09-16 | Bava is licensed Apache-2.0 | Keeps MIT dependencies and app-store distribution open, and adds a patent grant and trademark clause. |
| 2026-09-16 | ~~D2 is dropped entirely;~~ the canvas is free-placement. **D2 part superseded 2026-09-17** by Diagram from Code converting to shapes | The product is a canvas where the user places things, not a layout language. |
| 2026-09-16 | Konva (MIT) is the canvas foundation | Scene graph, hit-testing and transforms, framework-agnostic; SVG export is written by hand. |
| 2026-09-16 | ~~A `diagram` element stores its D2 source inline~~ **superseded 2026-09-17:** diagrams become shapes, the source is discarded | |
| 2026-09-16 | ~~Bindings store a node id, never coordinates~~ **superseded 2026-09-19:** a binding stores the attached element's id; the detached rule stands | |
| 2026-09-16 | Canvas text is measured in the frontend, and the measurement is stored in the file | Webviews disagree on glyph advances, so stored sizes make a scene reopen identically; D2 text is still measured in Go. |
| 2026-09-16 | Geist and Geist Mono, bundled as variable woff2 | OFL 1.1 and small; Geist for chrome, Geist Mono for code, labels and data (amended 2026-10-11). |
| 2026-09-16 | One chat thread per file, not per object | A diagram attaches to a message as context, keeping one transcript per file. |
| 2026-09-16 | A remote icon URL is never fetched | Fetching it would tell a CDN that someone opened the file; icons resolve locally. |
| 2026-09-17 | Radius, motion and z scales are ours, not the design's | The design sheet specifies none, so values follow the mockups and honour reduced motion. |
| 2026-09-17 | Two colour tokens added beyond the design sheet | `text-prose` and `focus-halo` are both used in the mockups but unnamed. |
| 2026-09-17 | No hover or pressed tokens, and no `warning` | The mockups show no such states; they arrive with the first component that needs one. |
| 2026-09-17 | Shape colours are scene data, not tokens | They are the user's content, not chrome. |
| 2026-09-17 | All 18 D2 theme slots are mapped, not just the plausible ones | An unmapped slot keeps D2's pale default and surfaces on some shape type. |
| 2026-09-17 | `Render` rejects a partly-filled theme | A partial theme renders subtly wrong instead of failing. |
| 2026-09-17 | The no-literals rule is a test, not a grep | `src/styles/no-literals.test.ts` runs with the suite; a command nobody runs decays. |
| 2026-09-17 | The window is 1280×800 | Four regions must fit side by side; pinned by a test. |
| 2026-09-17 | The native window background is no longer set | A pinned dark background flashed behind a light page at launch. |
| 2026-09-17 | Settings is a dialog, not a route | There is no navigation model to hang a route on. |
| 2026-09-17 | Translations are a typed key map, not a library | One locale needs no library, and an unknown key fails to compile. |
| 2026-09-17 | Document and canvas regions are hidden with CSS, never unmounted | Unmounting would destroy the editors and their undo history. |
| 2026-09-17 | Class names on Ark's own elements are prefixed | Those rules must be `:global()`, so a generic name leaks app-wide. |
| 2026-09-17 | ~~Milestone 1's keyboard debt moves to Milestone 4~~ **closed:** there is no click-on-node since diagrams became shapes | |
| 2026-09-17 | Undo is patch-based, via `immer` | Immer gives both directions from one mutation; a no-op mutation records no step. |
| 2026-09-17 | Canvas tests use `vitest-canvas-mock`, not the native `canvas` package | The tests check scene patching, not pixels, and need no native build on CI. |
| 2026-09-17 | ~~No spatial index yet~~ **superseded 2026-09-27** by "No spatial index", measured | |
| 2026-09-17 | Grouping does not move its children | Children keep their coordinates, so ungrouping is just removing the wrapper. |
| 2026-09-17 | ~~The D2 preview is absent between Milestones 4 and 6~~ **closed:** the preview lives in the Diagram from Code dialog | |
| 2026-09-17 | A Bava file is Markdown with a trailing `bava-canvas` block | A fenced block cannot be separated from its document by a rename or partial copy. |
| 2026-09-17 | Markdown is scanned, never parsed | A parser round-trips prose approximately, which corrupts files others wrote. |
| 2026-09-17 | Saves are atomic | Temp file in the same directory, fsync, rename: a crash leaves old or new, never truncated. |
| 2026-09-17 | Saving into a directory that does not exist is an error | Creating directories turns a path typo into empty folders; Bava's config directory is the exception. |
| 2026-09-17 | Conflict detection is size plus modification time, not a hash | Cheap enough to check on every focus change. |
| 2026-09-17 | Preferences live in the platform config directory | They are Bava's state; unreadable or bad values fall back to defaults per value. |
| 2026-09-17 | Recent files stay in `localStorage` | A convenience, not work product. |
| 2026-09-17 | A drag is one undo step | One undo should put a dragged shape back. |
| 2026-09-17 | Movement under three pixels is a click | Otherwise a click leaves a zero-size element. |
| 2026-09-17 | Canvas repaints from a published snapshot, not a counter | The render effect then depends on the actual data. |
| 2026-09-17 | Saving and opening policy lives in `files/actions.svelte.ts`, not markup | It is the logic that broke, so it is tested directly. |
| 2026-09-17 | ~~"Open" opens a file and lists its folder~~ **superseded 2026-09-27** by "⌘O opens a Space; ⇧⌘O opens a file" | |
| 2026-09-17 | The native menu is data | `internal/app/menu/spec.json` declares the tree, and tests check ids, accelerators, handlers and docs. |
| 2026-09-17 | No accelerator without a modifier | A native accelerator on a bare key steals it from every text field. |
| 2026-09-17 | `⌘B`, `⌘I`, `⌘U`, `⌘K`, `⇧⌘X` are reserved | The Document needs them; enforced by a test. |
| 2026-09-17 | Menu-bound shortcuts leave the JS keymap | Handled in both places, a key acts twice. |
| 2026-09-17 | Edit commands route by focus | The focused element decides, so Select All then Delete cannot empty a hidden canvas. |
| 2026-09-17 | Cut, Copy and Paste are commands, not native roles | The roles never reach the canvas on Windows and Linux; the Wails clipboard works on all three. |
| 2026-09-17 | Punctuation shortcuts are handled by the page | Wails on Windows never fires a punctuation accelerator, so the page matches `event.code`. |
| 2026-09-17 | Menu labels are English in the spec, for now | Go builds the menu before the frontend exists, and there is one locale. |
| 2026-09-17 | Loading a document resets history | Opening a file is not an edit, and undo must not bring the previous file back. |
| 2026-09-17 | A save marks the document clean only if nothing changed while it wrote | An edit made during the write is not on disk. |
| 2026-09-17 | Autosave is off by default | Writing to someone's files unasked is their choice; modes `off`, `afterDelay` (1000ms, 200 to 60000), `onFocusChange`. |
| 2026-09-17 | Autosave never writes an untitled document | That would need a save dialog or an invented path. |
| 2026-09-17 | A conflict pauses autosave without prompting | A dialog mid-sentence is worse; the status bar says so and a manual save resumes. |
| 2026-09-17 | Open and Save left the title bar | A desktop user looks for them in the File menu. |
| 2026-09-17 | The brand mark is paper on ink, always | The brand rule; held in `--color-mark` and `--color-mark-tile`. |
| 2026-09-17 | App icons are designer exports, not generated in-repo | Each platform's master is a design decision, and generating needs a rasteriser. |
| 2026-09-17 | The mark ships without its C2PA manifest | The app ships the drawing only; a test pins its path data by SHA-256. |
| 2026-09-17 | No Assets.car until Xcode is available | It cannot be rebuilt without `actool`, so it and `CFBundleIconName` are removed. |
| 2026-09-17 | About shows no version yet | A placeholder number would be a false claim. |
| 2026-09-17 | DMG installer art waits for release | Nothing ships a DMG before packaging. |
| 2026-09-17 | The empty-state mark fades only in the dark theme | Faded on light, its ink tile becomes a forbidden mid-grey; 0.32 dark, 1 light. |
| 2026-09-17 | Chat rendering: `markstream-svelte` is the candidate, subject to a spike | One library for streamed markdown and code, if it passes no-network, theming and size checks. |
| 2026-09-17 | Menu hints appear in labels on Windows only | Only Windows right-aligns text after a tab. |
| 2026-09-17 | Errors and logs stay on the user's machine | Local per-session logs (10 sessions, 50 MB), plain dialogs, nothing uploaded, no content in logs. |
| 2026-09-17 | Report Issue is hidden until release | Its public tracker is confirmed at release; one constant switches it. |
| 2026-09-17 | The first unexpected error opens a dialog; later ones only note the status bar | A repeating failure must not stack modals. |
| 2026-09-17 | A crashed panel is contained, and reloading it loses its undo | `<svelte:boundary>` contains it, and the fallback says the undo history goes. |
| 2026-09-17 | Logs never hold file paths or names | A file name can be content. |
| 2026-09-17 | Wails gets a warn-only logger with no attribute values | Wails logs bound calls' arguments at debug, which is document content. |
| 2026-09-17 | A panic inside InvokeSync exits | Wails would leave the caller waiting forever; the next launch reports the crash. |
| 2026-09-17 | Frontend errors are logged by kind and frames, never message | JavaScript messages quote input. |
| 2026-09-17 | One marker per session, keyed by PID | Two running Bavas must not report each other as crashed. |
| 2026-09-17 | Elements carry every key across the frontend bridge | Saving had dropped unknown and element-specific keys. |
| 2026-09-17 | Shape colours are eight named swatches plus the theme default | `gray`, `blue`, `green`, `yellow`, `orange`, `red`, `purple`, `pink`, each with light and dark values; the file stores the name. |
| 2026-09-17 | A shape's label is not separately measured | It wraps inside the box, so webview differences move nothing else. |
| 2026-09-17 | Resize goes through the pointer handler, not Konva's Transformer | One input path, so a handle press cannot also start a move. |
| 2026-09-17 | Scaled geometry is rounded to three decimals | Floating-point dust would be written into the file. |
| 2026-09-17 | The file writer does not HTML-escape | Escaping rewrote labels like "A -> B" on every save. |
| 2026-09-17 | Placing text is one undo step | Recording an empty element first left an invisible one after undo. |
| 2026-09-17 | Text block size is the widest line and one line height per line | Measured as one line, multi-line text drew only its first line. |
| 2026-09-17 | Canvas keys leave Enter, Space, Tab and arrows to a focused control | Handled at window level they broke button activation. |
| 2026-09-17 | Canvas drawing sizes are tokens; behavioural constants stay named in code | Sizes are `--size-*` tokens; tuning constants sit beside their logic. |
| 2026-09-17 | Bava launches with no file open | Demo content was content nobody wrote; see `.claude/work/specs/launch.md`. |
| 2026-09-17 | A splash covers startup, with an indeterminate bar | Shown until settings and fonts load, capped at 2 seconds; nothing reports real progress. |
| 2026-09-17 | Settings is reached only from the native menu | The title bar button duplicated the menu item. |
| 2026-09-17 | The log session closes in `PostShutdown` | On macOS `Run` never returns, so quits were reported as crashes; the call after `Run` stays for Windows. |
| 2026-09-17 | Diagrams become free shapes; Diagram from Code renders D2 once and converts it | Converted shapes (`frontend/src/canvas/import/convert.ts`) edit like any other, with no second copy to sync. |
| 2026-09-18 | A properties panel is the baseline for canvas controls | Every style a selection has is set in one place; see `.claude/work/specs/canvas-toolbar.md`. |
| 2026-09-18 | Comments are dropped | A local-only app has no one to address a comment to. |
| 2026-09-18 | An icon rail with an insert panel replaces the labelled rail and shape menu | Common tools on the rail, every other shape searchable in the panel. |
| 2026-09-18 | A right-click menu and a bottom selection toolbar, grouped, with submenus | One tree (`canvas/context-menu.ts`) serves both, listing only working actions. |
| 2026-09-18 | ~~Arrange, align, distribute, flip, duplicate and copy/paste styles are canvas-scoped shortcuts~~ **superseded 2026-09-26** by "Only necessary shortcuts are bound" | |
| 2026-09-18 | Flip mirrors positions and points only, until 06.3 | Mirroring an asymmetric body needs a stored flag. |
| 2026-09-18 | Lucide is bundled now, at 1.44.0 | Needed for interface icons; the newer release was under the 7-day minimum age. |
| 2026-09-18 | macOS uses the standard hidden title bar | The inset variant placed the traffic lights below Bava's 36px bar. |
| 2026-09-18 | Export and code blocks move forward, to Milestones 6.4 and 6.7 | Sequencing agreed with the user. |
| 2026-09-18 | Shift constrains a drag, and is read while dragging | The preview follows the key as it is pressed or released. |
| 2026-09-18 | A resize draws no marquee | The marquee belongs to dragging empty space. |
| 2026-09-18 | The toolbar's colour controls are chips, named by tooltip | Labels made the bar wrap. |
| 2026-09-18 | A picked colour is stored once and adapted to the other theme | Bava themes per element, so one authored colour is stored and adapted. |
| 2026-09-18 | Eleven style keys are optional, with the element's default meaning "unset" | Older files read the same, a default removes the key, and unknown values round-trip. |
| 2026-09-18 | A colour is a swatch name or a `#rrggbb` literal, adapted at draw time | ~~Lightness flipped below `MIN_CONTRAST`~~ superseded 2026-09-27 by "shows as picked in light and inverted in dark". |
| 2026-09-18 | Round edges are a fixed radius on a rectangle and a proportional one on a polygon | Rectangle corners keep their size; curved outlines get no `edges`. |
| 2026-09-18 | An arrow's shape is a route, computed from its points | `arrows.ts` is pure and testable, and stored points stay what the user dragged. |
| 2026-09-18 | A locked element is inert but still drawn and exported | Unlock All on empty-canvas right-click avoids selecting the unselectable. |
| 2026-09-18 | A toolbar control that does not fit the row moves into More, as a submenu of its choices | Overflowing controls had vanished. |
| 2026-09-18 | Choosing a property's default removes its key | The file records only what was chosen. |
| 2026-09-19 | An element stores an upright box and an `angle`, and Konva turns it about the centre | The file stays readable: upright `x`, `y`, `w`, `h` plus one number. |
| 2026-09-19 | One selected element is outlined at its own angle; several are outlined upright | Several elements share no angle. |
| 2026-09-19 | Shift snaps one element to a multiple of 15°, and a multi-selection's turn to 15° steps | Several elements must keep their relative angles. |
| 2026-09-19 | An elbow arrow does not rotate | A turned elbow is no longer orthogonal. |
| 2026-09-19 | The log permissions test skips on Windows | Windows reports fixed mode bits and uses ACLs, so the assertion means nothing there. |
| 2026-09-19 | Every pointer drag expands a group to its children | Dragging only the wrapper moved nothing visible. |
| 2026-09-19 | A rotated member of a multi-selection scales through its drawn bounds | The frame's scale is resolved into each element's own axes. |
| 2026-09-19 | An export is drawn by the canvas's own code, never a second renderer | Stage and exporter share `canvas/paint.ts`, so they cannot differ. |
| 2026-09-19 | An exported SVG carries the font when it carries lettering | Geist embedded as base64 (about 93KB) reads the same without the font installed. |
| 2026-09-19 | Copy as PNG goes through the webview clipboard | The Wails clipboard carries text only; a refused write opens the export dialog. |
| 2026-09-19 | Exporting in the other theme swaps `data-theme` for the length of the draw | Tokens are scoped to `:root[data-theme]`; the swap is synchronous and restores on a throw. |
| 2026-09-19 | Line breaking and smoothing happen once, outside the renderers | `text-layout.ts` and `curves.ts` make canvas and export identical. |
| 2026-09-19 | An embedded face is named after the first family of the stack | A face named after the whole stack matches nothing. |
| 2026-09-19 | An attached arrow aims at the centre and stops on the outline | The file stores only the attached ids, so moving a shape re-aims with nothing to sync. |
| 2026-09-19 | Drawing an arrow onto a shape attaches it, ~~and Alt prevents it~~ **Alt part superseded 2026-09-26** by "An arrow end dropped inside a shape is pinned there" | It makes a generated diagram survive its first move; a line never binds. |
| 2026-09-19 | Deleting a frame keeps its contents | Deleting a container must not delete unselected work. |
| 2026-09-19 | Re-routing runs inside `history.mutate` | Every edit gets it, and one undo restores a shape with its arrows. |
| 2026-09-19 | An inserted diagram lands centred in the view, selected | It arrives where the user is looking, ready to drag. |
| 2026-09-19 | A generated shape arrives in Bava's own style | D2's palette is not carried over, so diagrams match the canvas and theme. |
| 2026-09-19 | A diagram arrives at its own size, one to one | Text stays readable and diagrams match each other. |
| 2026-09-19 | A previewed SVG has its remote references stripped | `withoutRemoteRefs` stops previews fetching icons or navigating the window. |
| 2026-09-19 | A connection whose endpoints are not shapes is not inserted | A half-attached arrow nobody drew is worse than none. |
| 2026-09-20 | A code block is drawn as canvas text, not a picture | Sharp at any zoom, selectable in exports, themed. |
| 2026-09-20 | Each language loads the first time it is used | Dynamic imports from the app's own files keep startup light; a test asserts no network. |
| 2026-09-20 | ~~A code block is sized by its code, and has no resize handles~~ **superseded 2026-09-26** by "A code block's width is the user's" | |
| 2026-09-20 | A language name is a proper noun, not a message key | Language names are not translated. |
| 2026-09-26 | Mermaid is not supported now; revisit with the AI milestone | D2 already covers text-to-diagram; a second language costs a large library. |
| 2026-09-26 | The Diagram from Code dialog chooses the layout engine, and the choice becomes the default | The preview shows the difference; the code's own `direction:` wins. |
| 2026-09-26 | A code block's width is the user's, and its code wraps | Wrapping with the height following keeps code from being hidden. |
| 2026-09-26 | An elbow arrow stores its route in its points | Routing needs the scene, which the drawing path lacks, so it is computed once and stored. |
| 2026-09-26 | Only necessary shortcuts are bound | Universal, drawing, Flip, Lock and view keys kept; nineteen rare or clashing ones dropped to menus. |
| 2026-09-26 | An arrow end dropped inside a shape is pinned there | Stored as `startMode`/`endMode: "inside"`; Alt pins anywhere, Cmd/Ctrl leaves it free. |
| 2026-09-26 | A bent line offers its segment middles only in point editing | A bent line's handles stay few outside point editing. |
| 2026-09-26 | All 90 items of one line and arrow checklist are built | Built across 06.14 to 06.16; where one conflicts with an earlier choice, the checklist wins. |
| 2026-09-26 | An attached elbow is not dragged away by its body | Its route belongs to its shapes. |
| 2026-09-26 | ~~A segment's middle handle beats an arrow label over it~~ **superseded 2026-10-04:** the middle handle sits beside the label | |
| 2026-09-26 | Elbow padding is 40 clear on every side | A turn never crowds a shape or its head. |
| 2026-09-26 | A code block's height is the user's, never below its code | Code is never hidden. |
| 2026-09-27 | Drawing reads the style defaults from their own module | `canvas/style-defaults.ts` breaks an import loop that left defaults undefined. |
| 2026-09-27 | The rotate cursor is a small inline image, black on white | CSS has no rotate cursor; system cursors ignore theme too. |
| 2026-09-27 | New arrows are curved and new lines round | A hand-drawn line reads as drawn; the kind is written, so older files are unchanged. |
| 2026-09-27 | A two-point curved arrow is straight | With nothing to bend around, a bow surprises. |
| 2026-09-27 | `Q`, `⌘`/`Ctrl`+`Enter` and `⌘`/`Ctrl`+`D` in point editing are shortcuts | The user's choice after the shortcut trim. |
| 2026-09-27 | Delete with no point selected, and double-click on a bend, do nothing | Both could delete by mistake. |
| 2026-09-27 | A line can be closed into a loop, and a closed line filled | Stored as `closed: true`; `fill` only while closed. |
| 2026-09-27 | New elements take the last style chosen, for the session only | A run of shapes needs one style choice; it is not document state. |
| 2026-09-27 | An arrow's label sits on its middle point | The middle point, or the middle of the middle segment. |
| 2026-09-27 | Deleting a shape still freezes its arrows' ends | A binding whose target disappears freezes and is marked detached. |
| 2026-09-27 | Heads are sized by kind, in scene units | Arrow 25, bar 15, diamond 12, crow's foot 15, cardinality 20, others 15, capped on short arrows. |
| 2026-09-27 | Outline heads are filled with the canvas colour | The line no longer shows through them. |
| 2026-09-27 | Dash patterns scale with the stroke width | Dashed [8, 8 + width], dotted [1.5, 6 + width], non-solid 0.5 thicker. |
| 2026-09-27 | A lone attached arrow lets go only past 10 units, and when resized or rotated | A small slip no longer detaches it. |
| 2026-09-27 | Both ends of an arrow may attach to one shape | So a self-loop can be drawn. |
| 2026-09-27 | Attaching and the side-middle snap are settings | Two toggles in Settings ▸ Canvas, on by default. |
| 2026-09-27 | A file's modification time crosses to the frontend as a string | As a number its nanoseconds rounded, raising false conflicts. |
| 2026-09-27 | A code block shows its language on its top edge, and takes a font size | Sizes 11, 13, 16, 20 (absent 13); plain text shows no name. |
| 2026-09-27 | An arrow's label can lie along the arrow | `labelDirection: along`, never upside down; absent means upright. |
| 2026-09-27 | Shapes snap to other objects, off by default | Free placement stays free; on via Settings ▸ Canvas or `⌥S`, inverted by `⌘`/`Ctrl` while dragging. |
| 2026-09-27 | Every element snaps by its box | One rule (corners, side middles, centre) fits every element and the selection box. |
| 2026-09-27 | A moving frame's contents and the arrows attached to what moves are not snap targets | They would draw guides to where nothing is. |
| 2026-09-27 | Equal spacing counts neighbours only | Counting every pair stalled a drag start by 152 ms on 2,000 shapes. |
| 2026-09-27 | No spatial index | Measured on 2,000 shapes (`canvas/scale.bench.test.ts`): every query is cheap enough; snapping keeps sorted targets instead. |
| 2026-09-27 | A Space is a folder with a hidden `.bava/` | Pages are plain files; the Space's own data (`space.json`, the Trash) sits in `.bava/`. |
| 2026-09-27 | The Trash never empties itself | A local app has no storage reason to delete by age. |
| 2026-09-27 | ⌘O opens a Space; ⇧⌘O opens a file; ⌘N makes a page beside the open one | A Space is the main way in; a new page is named in the tree first. |
| 2026-09-27 | Menu and button labels carry no trailing ellipsis | The dialog a command opens says enough. |
| 2026-09-27 | New Space asks for a name and a place | One dialog makes and opens the folder; a taken name is refused, never merged. |
| 2026-09-27 | Code comments do not cite plans, milestones, decisions or reviews | Those documents are temporary; a comment explains the code in its own words. |
| 2026-09-27 | The canvas shows a dot grid | A dot every 20px, thinned when zoomed out, never exported or saved. |
| 2026-09-27 | Space settings apply on Save | Cancel, close and Escape discard. |
| 2026-09-27 | A picked colour shows as picked in light and inverted in dark | Flipping near-canvas colours turned pale fills black; named swatches keep their own dark values. |
| 2026-09-27 | A page's settings live in a front-matter header under `bava:` | Other Markdown tools expect a YAML header; other lines are kept as written. |
| 2026-09-27 | Formatting Markdown lacks is written as invisible marks and small HTML | `<!-- bava: color=red -->`, `<u>`, `<span data-…>`: other viewers show plain text and lose nothing. |
| 2026-09-27 | What the Document cannot edit yet is kept byte for byte | Opening and saving never changes what Bava does not understand. |
| 2026-09-27 | ⌘/ opens the block menu; Alt+F10 moves into the formatting bubble | Both reachable from the keyboard. |
| 2026-09-27 | Find in the Document is ⌘F; Find and Replace is ⌥⌘F | Both in the Edit menu; the bar marks every match. |
| 2026-09-27 | 8.3 is built in three parts | Blocks, rich tables, then links and date chips, each committed on its own. |
| 2026-09-27 | A custom callout keeps its colour and icon in an invisible mark | Other apps show a plain note. |
| 2026-09-27 | ~~Only headings made toggles fold;~~ folding is remembered on this computer. **Toggle headings superseded 2026-09-28** by "No toggle headings" | Folding never changes the file. |
| 2026-09-27 | A code block's wrap and caption go in an invisible mark | The fence stays plain for every app. |
| 2026-09-27 | The contents block is written out as a list | Links between `<!-- bava: contents -->` marks, rewritten on save. |
| 2026-09-27 | Code in a page is page text, highlighted, not a code editor inside the page | One undo history and no focus hand-off. |
| 2026-09-27 | Emoji use the system's emoji font | A colour emoji font would add about 10 MB. |
| 2026-09-27 | Emoji are listed up to Unicode's emoji 14.0 | Newer ones show as boxes on older system fonts. |
| 2026-09-27 | A toggle's summary is plain text | Formatting in `<summary>` shows as raw asterisks elsewhere. |
| 2026-09-27 | A footnote whose reference is deleted loses its note only on save | Cut and paste no longer loses the note's text. |
| 2026-09-28 | The `/` menu is one list in three groups: Basic, Advanced, Inline | Labels and dividers, never submenus. |
| 2026-09-28 | Enter in a footnote starts a new line in that note | A note can span lines. |
| 2026-09-28 | Turn into only within a family | Text and headings into one another; lists into lists, the whole list at once. |
| 2026-09-28 | A table is a Markdown table until it uses a rich option, then HTML | Merged cells, colours, widths or header changes need `<table>`. |
| 2026-09-28 | A table cell holds formatted text, never blocks | Both table forms can hold it, so other apps show the same table. |
| 2026-09-28 | A date chip is a date tag around the readable date | `<time datetime="…">`: other apps show the date. |
| 2026-09-28 | A page link's text follows the page's name, unless reworded | A relative `%20`-encoded link; renames rewrite addresses and unreworded text. |
| 2026-09-28 | A click on a link shows its card; ⌘/Ctrl-click opens it | A click can still place the caret. |
| 2026-09-28 | One reader decides what a link is | Renames touch exactly the links the Document shows, and only unchanged pages are written. |
| 2026-09-28 | A line before or after any block; always a line at the end | ⌘Enter after, ⇧⌘Enter before; the trailing empty line is never saved. |
| 2026-09-28 | No toggle headings | A folded heading hid too much; the toggle list is the one fold. |
| 2026-09-29 | Images and video files are Markdown images with a mark | Every app shows the image; only Bava applies the mark's settings. |
| 2026-09-29 | Online videos and cards | A video is the image form with a mark, loaded on play; a card is a link with a mark. |
| 2026-09-29 | A missing attachment is offered for relinking, never relinked by itself | Nothing changes until the user presses Relink. |
| 2026-09-29 | Images on the web are shown; videos on the web wait for play | Any Markdown viewer shows web images; see `docs/file-format.md`. |
| 2026-09-29 | Online videos play in a sandboxed frame; a card never runs a program | ~~Browser fallback not needed~~ superseded the same day (row below). One click never runs code; card details are fetched in Go with hard limits (8 s, 5 redirects, 1 MB, no cookies). |
| 2026-09-29 | Videos show a picture when the page opens; YouTube plays in the browser where it refuses Bava's window | YouTube refuses pages with no web address (error 153), so play opens the browser. |
| 2026-09-29 | 8.4 is built in three parts | Attachments, online videos and cards, then Media. |
| 2026-10-04 | A middle handle sits beside an arrow's label, never on it | It covered the label's text; one rule (`besideLabel`) places it. |
| 2026-10-04 | A save Go refuses pauses autosave as a failed save does, and its reason shows in the status bar | Otherwise autosave retries and fails unseen on every edit. |
| 2026-10-04 | Pictures are sheets: each family of things once per theme, every state side by side | Hundreds of single pictures were slow to review and said little. |
| 2026-10-04 | Every picture in both themes, screens and dialogs included | Dark-mode faults can be specific to one screen. |
| 2026-10-04 | Selected text is Bava's `selection` colour, not the system highlight | One look on every platform. |
| 2026-10-04 | Each CI build is kept as a download for 14 days | The real app on real files, instead of a hosted preview. |
| 2026-10-04 | An embedded frame's picture is a PNG at twice size | Every app shows it the same, sharp on dense screens. |
| 2026-10-04 | The picture is drawn in the theme Bava has when it is saved | It matches the screen. |
| 2026-10-04 | The picture is the frame's area, without the frame | No border or label; settled further 2026-10-10. |
| 2026-10-04 | An embed takes an image's width, alignment and caption | No ratio: the frame decides the shape. |
| 2026-10-04 | A loose page asks to become a Space before it embeds | The rule every picture a page holds follows. |
| 2026-10-04 | Opening an embed from the Document view shows Both | The page stays, with the frame selected beside it. |
| 2026-10-06 | Removing a Space from the list asks, and can delete its `.bava` folder | Off by default and permanent, as Bava has no system-Trash support; pages are kept. |
| 2026-10-06 | 8.6 is built in two parts, tags first | Smaller plans and commits. |
| 2026-10-06 | A tag is lowercase with no spaces, converted as typed | `Road Map` becomes `road-map`; other tools' tags are rewritten only when that page's tags change. |
| 2026-10-06 | Tags sit at the bottom of the page | After the content, before Linked from. |
| 2026-10-06 | Tags filter Files; no Tags section | The tree shows pages with all chosen tags. |
| 2026-10-06 | A tag's menu has Rename, Merge into and Delete | Each rewrites only the pages' `tags` key. |
| 2026-10-06 | A Tags dialog manages tags, several at once | Rename, merge or delete several, asked first. |
| 2026-10-07 | A template's group is a folder | `.bava/templates/<group>/<name>.md`, visible in any file manager. |
| 2026-10-07 | New page from template is a submenu in Add | In the Files Add menu and a folder's right-click menu. |
| 2026-10-07 | A template is copied as it is | No fill-ins. |
| 2026-10-07 | A template is edited like a page | In the main area under a bar with Done. |
| 2026-10-07 | A deleted template is gone for good, after asking | It does not go to the Trash. |
| 2026-10-10 | An embed's picture is everything in the frame's area | A frame drawn around existing shapes shows them. |
| 2026-10-10 | No Copy link in the page menu | Pages link to each other from inside a page. |
| 2026-10-10 | No menu state for unsaved changes or undo, no Clear Recent, no native About panel | About stays an in-app dialog. |
| 2026-10-11 | Bava looks quiet and precise, in black and white | Chosen from four feels and three palettes, no accent setting; see `.claude/work/specs/look.md`. |
| 2026-10-11 | Every Space letter is the ink; the canvas ground is white | Per-Space colours are gone, and the canvas sits on the ground colour. |
| 2026-10-11 | Milestone 15 is built in four parts, search first | Search, export, import, then canvas work. |
| 2026-10-11 | Search: a palette on ⇧⌘F over names, page text and canvas text, one row per page | Results open at their match; ⌘K stays Link. |
| 2026-10-11 | The Canvas gets a find bar | ⌘F outlines matching elements and steps through them. |
| 2026-10-11 | A PDF is made by each system's own page printing | Real selectable text drawn as Bava draws; nothing leaves the machine. |
| 2026-10-11 | Export is grouped by what is exported: Page, Canvas, Space | Each offers only its own formats. |
| 2026-10-11 | Export is built in three parts, PDF proven first | PDF printing proven on CI before dialogs and PDF export. |
| 2026-10-11 | PDF printing proven on macOS, Windows and Linux | CI run 38089701163; Windows uses a hidden window's WebView2 and `Page.printToPDF`. |
| 2026-10-11 | A zip carries everything but the Trash | It reopens as the same Space. |
| 2026-10-11 | Page numbers read as the number alone | "3", bottom centre, in Bava's font. |
| 2026-10-12 | Page numbers are stamped into the PDF, in Helvetica | The webview printed them white over each page on macOS, and misplaced them; the one exception to Geist everywhere, chosen over adding a TrueType Geist. |
| 2026-10-11 | A page fits the paper's width, with no scale to choose | The page's width fills the paper between margins. |
| 2026-10-11 | A page's PDF before a folder's or the Space's | It proves printing real pages first; pdfcpu (Apache-2.0) joins and numbers after. |
| 2026-10-11 | A folder or the Space exports one combined PDF, contents first | Contents and bookmarks by folder; a page that cannot print stops the export. |
| 2026-10-11 | Bava ships through the stores only, with no updater | The Mac App Store, Microsoft Store and Flathub update the app, so Bava makes no network call of its own. |
| 2026-10-11 | Bava moves to Tharabyte: `tharabyte/bava`, `com.tharabyte.bava` | Module `github.com/tharabyte/bava` and app ID fixed from the first release; settings and log folders do not move. |
| 2026-10-11 | An AI disclosure: AI-assisted, human-reviewed | `AI-DISCLOSURE.md` says where AI is used; the Flathub submission is not AI-assisted. |
| 2026-10-11 | Bava in its own words: no other product named, no studies kept | Guarded by `names_test.go` and `.ai/rules/own-words.md`; history is not rewritten. |
| 2026-10-11 | Adapted canvas code is attributed now and written afresh next | MIT-derived canvas parts are credited in `NOTICE` until rewritten as R1c. |
| 2026-10-11 | No AI disclosure file or names test until release; `NOTICE` trimmed | The owner: both go until the release rewrite, the own-words rule stands on review; `NOTICE` keeps Bava's licence and the adapted code's attribution, and release builds will carry generated third-party licences. |
| 2026-10-12 | Import: pages, folders and Bava zips, into a folder chosen | `.claude/work/specs/import.md` decisions 1 to 11: a folder comes in whole, clashes numbered never overwritten, every other file attached, hidden files left behind, a zip's templates but never its settings, addresses rewritten only where they must change; import and export count and cancel; a long task is stopped by a name the page gives it, so its call answers how it really ended. |
| 2026-10-11 | The adapted canvas code keeps its attribution; no rewrite | The owner: `NOTICE` carries the MIT notice for good, as is usual for reused code; a rewrite would risk the canvas's most delicate parts for no gain in compliance. |
| 2026-10-13 | Diagram from Code is renamed D2 diagram, and what adds to the canvas sits in the Canvas menu | `.claude/work/specs/canvas-work.md` decision 18: the name says the language written, as the dialog's "Write D2" did; File ▸ Diagram from Code and File ▸ Picture become Canvas ▸ Diagram ▸ D2 Diagram and Canvas ▸ Picture, kept in the command palette. Stored names, past plans and specs are unchanged. |
