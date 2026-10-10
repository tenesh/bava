# 8.5: Canvas in the Document, decisions

> Historical: implemented (or superseded); kept as the record.

Settled with the user before the plan, one question at a time. They fill
holes in decisions 24 to 27 and 61 of `documents.md`; decision 5 changes
61, and decision 3 (as settled on 2026-10-10) refines 26.

### 1. The saved picture is a PNG at twice size (2026-10-04)

An embedded frame's picture in the Space's attachments is a PNG drawn at
twice the frame's size: every app and site shows it the same way, and it
stays sharp on high-resolution screens.

### 2. The saved picture is drawn in the theme Bava has when it is saved (2026-10-04)

The user's choice: it matches what was on screen. Switching Bava's theme and
saving rewrites every embedded picture the save touches. Inside Bava, an
embed is always drawn live in the current theme.

### 3. The picture is the frame's area, without the frame (2026-10-04)

The frame's rectangle, on the canvas background, cut at its edges; no border
and no frame label. The frame chooses what is shown and is not part of it.

*Settled further by the user on 2026-10-10:* the picture is everything drawn
in the frame's area, whether or not it belongs to the frame (was dropped
into it): a frame drawn around shapes already there shows them, and a shape
over the frame's edge is cut there. As built in 8.5 it drew only the frame's
own members, and a frame drawn around existing shapes came out empty.

### 4. An embed takes an image's width, alignment and caption (2026-10-04)

The same menu as an image: `width` (small, medium, large, full), `align`
(left, right; centred without it) and `caption`. Without a width it is drawn
at its own size, up to the page's column. No `ratio`: the frame decides the
picture's shape.

### 5. A loose page asks to become a Space before it embeds (2026-10-04)

As for any media (decision 52 of `documents.md`): embedding a frame on a
page in no Space offers to make it a Space, then embeds. One rule for every
picture a page holds; the picture always goes in `.bava/attachments/`.

### 6. Opening an embed from the Document view shows Both (2026-10-04)

Clicking an embed (decision 24) in the Document-only view switches to Both:
the page stays on the left, the Canvas opens on the right with the frame
selected and in view. In Both, the Canvas side does the same; in Canvas
view there is no embed to click. A frame on another page opens that page,
in Both.
