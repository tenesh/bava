# Brand: decisions

From the Claude Design brand handover (v3), received 2026-09-17. The design
folders outside the repo are temporary; **the repo holds the only copies the
product depends on**:

- the mark: `frontend/src/brand/panda.svg`
- the icon masters: `build/darwin/appicon-mac.png`,
  `build/windows/appicon-windows.png`, `build/appicon.png`

The rules below are recorded here so they survive the handover's deletion.
Nothing in code or tests may read a path outside the repository.

## The mark

- One drawing at every size: `brand/panda.svg`, one path, `currentColor`,
  evenodd knockouts for the eyes and nose. No small-size variant; the
  handover tried one and rejected it. Below 20px the ear notches soften, which
  is accepted.
- 20px is the floor for brand placements (About, empty states). System chrome
  (title bar, tray, favicon) may go to the slot size, down to 12px.
- The file as delivered carries a C2PA provenance manifest (~7KB of base64 in
  `<metadata>`). It is stripped when vendored: the app ships the drawing, not
  the export tool's metadata.

## Colour: decided 2026-09-17

**Paper on ink, always.** Asked and answered: the v2 handover's rule replaces
the roadmap's v1 wording ("ink on light, paper on dark").

- The mark itself is always paper (`#e6e6e3`).
- On a dark ground it sits bare. On a light ground it sits in its own
  near-black tile (`#131416`). There is no ink-on-paper version.
- Never the product accent: that is reserved for selection and focus.
- Misuse (from sheet 5a): no stretching, rotating, recolouring, mid-tone
  grounds, or inverting.

## Faded mark: decided 2026-09-17, after review

Sheet 4c fades the mark to 32% behind an empty state, but shows only the dark
theme, where the mark sits bare. On light, fading would also fade the ink tile
into a mid-grey ground, which the misuse sheet forbids. So the fade applies in
dark only (`--opacity-mark-faded`); on light the tiled mark is full strength.
Revisit if the designer supplies a light-theme treatment.

## Type

- Wordmark: Geist Medium, lowercase `bava`, −0.4px tracking at 22px and above.
- Descriptor: Geist Mono, caps, 0.9px tracking.

## App icons: decided 2026-09-17

**Designer-exported PNGs**, committed as delivered. Asked and answered: not
generated in-repo, and no rasteriser dependency. Every change to the mark
needs a new export.

Delivered 2026-09-17, each 1024×1024 PNG. Construction, from the handover's
sheet 06:

1. macOS (`icon-macos-1024.png`): 824px squircle tile, 100 margin, radius
   186, shadow baked in. → `build/darwin/appicon-mac.png` → `icons.icns`.
2. Windows (`icon-windows-1024.png`): full bleed, no radius (Windows masks).
   → `build/windows/appicon-windows.png` → `icon.ico` at 256–16.
3. Linux (`icon-linux-1024.png`): full bleed, radius 128 baked in.
   → `build/appicon.png`, copied by the AppImage task and by nfpm (deb, rpm)
   into `hicolor/128x128`, a 1024px file in a 128px slot, carried to
   Milestone 16.

Not done: sheet 06's Linux `hicolor/<size>` PNG set and
`scalable/apps/bava.svg`; the Wails Linux packaging takes one PNG. The DMG file
icon (`build/darwin/dmg-file-icon.*`) and `dmg-background.png` are still the
Wails template. Decided 2026-09-17 to leave them for Milestone 16 (release),
since nothing ships a DMG before then. The DMG volume icon already uses
`icons.icns`. The Windows MSIX package has the same problem: `wails3 tool msix`
writes Wails placeholder tile and logo PNGs. Also Milestone 16.

**macOS 26 `Assets.car` is not rebuilt.** `Info.plist` names both
`CFBundleIconName` (Assets.car, compiled from `build/appicon.icon` by Xcode's
`actool`) and `CFBundleIconFile` (`icons.icns`). The template's Assets.car
holds the Wails logo and would win. `actool` is not installed, so Assets.car
and `appicon.icon` are removed and the `.icns` is used. A Liquid Glass icon is
deferred until someone with Xcode builds one.
