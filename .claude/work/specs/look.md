# The look: quiet and precise, in black and white

Settled with the user on 2026-10-11, one question at a time, after the user
asked to rethink the whole UI before Milestone 15: "It just doesn't feel
polished or unique like its missing its personality." Mockups were drawn
to choose from (reference, not spec; deleted once decided, as everything
chosen is written here). Where a mockup showed a control, what the control does stays as built; this spec changes
how Bava looks, not what it does.

### 1. Quiet and precise (2026-10-11)

Chosen from four feels drawn on the same screen (warm and crafted, quiet and
precise, bold and playful, editorial). A pro tool's calm: hairlines, small
dense rows, monospace for whatever is data, one accent used sparingly.

### 2. Black and white (2026-10-11)

Compared on every screen against violet and a deep teal (#003131). The
accent is the ink: black in light, white in dark, for selection, focus,
primary buttons, ticked boxes, Space letters, handles and snapping guides.
Neutrals are pure greys, with no tint.

| Role | Light | Dark |
|---|---|---|
| Ground | `#ffffff` | `#0a0a0a` |
| Chrome (title bar, side pane, status bar) | `#fafafa` | `#101010` |
| Sunken (code, callouts, thumbnails) | `#f5f5f5` | `#151515` |
| Raised (menus, rails, dialogs) | `#ffffff` | `#171717` |
| Hairline | `#ebebeb` | `#1f1f1f` |
| Strong line (controls, windows) | `#dcdcdc` | `#2c2c2c` |
| Ink, and the accent | `#0a0a0a` | `#f4f4f4` |
| Secondary text | `#2b2b2b` | `#cfcfcf` |
| Muted text | `#7a7a7a` | `#7c7c7c` |
| Faint text, idle icons | `#a6a6a6` | `#575757` |
| Wash (selected row, open menu item) | `#f0f0f0` | `#1e1e1e` |
| Text highlight | `#e6e6e6` | `#333333` |

Red stays for what deletes, and green for saved; neither is an accent.

### 3. No accent setting (2026-10-11)

Black and white for everyone; Appearance offers no accent colour.

### 4. No coloured edge on one side only (2026-10-11)

The user, on the first mockup: a violet edge on the left of a rounded row
or callout, with the other sides uncoloured, does not look right. A
selected row (a file, a recent Space, a settings section) gets the wash
across the whole row; a callout has an even hairline all round, its icon
carrying the emphasis.

*As built (2026-10-11):* a chosen row fills with `selection` (ink at 12%,
20% in dark), a step above the Wash, which is its hover; a callout keeps
its fill (its kind's colour) and has no border, its icon carrying the
emphasis. No coloured edge on one side anywhere.

### 5. The canvas keeps its dots (2026-10-11)

The dot grid stays, retuned to the new greys. A square grid and no grid
were offered.

### 6. Shapes keep their soft colours (2026-10-11)

The app is black and white; diagrams are not. The shape swatches stay
coloured, retuned to sit on the new greys, so colour can still group things.

### 7. Data and section labels in mono (2026-10-11)

Sizes, dates, paths, counts and shortcut keys are set in Geist Mono, as are
the small section labels (FILES, TAGS, RECENT SPACES): capitals, tracked.
Numbers that line up use tabular figures.

### 8. The start screen stays on a plain ground (2026-10-11)

As today, restyled: the mark, the three actions, recent Spaces with their
paths and dates in mono. A card on the canvas dots was offered.

### 9. The canvas tools stay on the left (2026-10-11)

A vertical bar, as today, in Both and in Canvas, with each tool's key
in its corner. Bottom and top centre were offered.

### 10. Four small touches (2026-10-11)

- **A saved dot:** a small green dot before "saved" in the title bar, amber
  while unsaved.
- **`#` on tags:** tags read `#launch`, in mono, in the page, the tag list
  and the dialogs. The `#` is drawn, not stored: the file keeps `launch`.
- **Position while dragging:** x and y, in mono, beside a shape as it moves.
- **Keys in menus:** each menu item's shortcut at its right, in a small mono
  key box.

### 11. Edges and depth (from the mockups, 2026-10-11)

Hairlines separate; panels are not filled to tell them apart. Shadows only
on what floats: menus, popovers, the tool rail, the selection bar, dialogs.
Corners 3 to 6px on controls, 10px on windows and dialogs.

### 12. What does not change

- **Fonts:** Geist and Geist Mono, as bundled.
- **The mark:** paper on ink, as in `brand.md`.
- **Behaviour:** every control does what it does today.
- **Search:** the mockups' ⌘K and side-pane search box are placeholders;
  search is Milestone 15.
