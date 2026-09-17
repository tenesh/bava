# Wails

## v3 only
`v3/pkg/application` API. Never the v2 `runtime` package. Three API
generations exist in the wild — v2, the long-lived v3 alpha, and the v3 beta —
and the alpha docs are still online at `v3alpha.wails.io`. Anything that looks
like alpha or v2 is wrong here.

The pinned beta tag is in `go.mod`. Wails cuts near-nightly betas, so `@latest`
today and `@latest` next week are different builds. Never float the version.

## Vendored docs win
`docs/wails-v3/` is pinned to our version. Context7 serves whatever is current
upstream, which may be ahead of us. When they disagree, the vendored copy is
right.

## Desktop only
`build/android/` and `build/ios/` were stripped from the template
deliberately, in a commit separate from the scaffold. Do not restore them,
and do not add mobile targets to build scripts.

## The frontend must be built before any Go command
`main.go` carries `//go:embed all:frontend/dist`, and `frontend/dist` is
gitignored. On a clean checkout the directory does not exist, so *every* Go
command that compiles the root package — `go vet`, `go test ./... .`,
`go build` — fails with:

```
main.go:17:12: pattern all:frontend/dist: no matching files found
```

It looks like a Go problem and is not. Run the frontend build first. This hides
locally because a stale `dist/` is usually lying around, which is exactly how it
reached CI unnoticed.

## Linux builds are GTK4, not GTK3
Wails v3 defaults to **GTK4 + WebKitGTK 6.0**. The GTK3 variant exists but is
opt-in behind a `gtk3` build tag — compare the cgo tags in
`pkg/application/linux_cgo.go` (`!gtk3`) with `linux_cgo_gtk3.go` (`gtk3`).

Install `libgtk-4-dev libwebkitgtk-6.0-dev libsoup-3.0-dev libglib2.0-dev`.
Installing the GTK3 packages instead produces a wall of pkg-config errors for
`gtk4` and `webkitgtk-6.0` that reads like a broken system rather than the
wrong variant being installed.

`wails3 doctor`'s package list names *both* variants' packages, so it is not a
safe guide on its own. **The build tags are the authority.**

## Cross-platform claims need CI
A successful `wails3 build` on macOS proves nothing about Windows or Linux.
The webviews differ — WKWebView, WebView2, WebKitGTK — and so do the build
toolchains. Never report "builds on all platforms" without a CI matrix result.

## Keep the native surface thin
File I/O, window management, menus, and the D2 pipeline. Everything else lives
in the frontend. The thinner this layer, the cheaper a shell swap would be if
the beta churn ever becomes untenable.

## Menu role items need a running application
`AddRole` constructs items like `NewHideMenuItem`, which read
`globalApplication.options.Name`. Outside a running app that is nil and the
call panics. Build menus after `application.New`; in tests, pass
`menu.Options{AddRole: …}` with a no-op.

## Windows shows no menu bar unless the window opts in
`WebviewWindowOptions.UseApplicationMenu` defaults to false, and in beta.20
Windows does not fall back to the application menu the way Linux does. Without
it Windows has no menu — and Bava's Open, Save and Undo live there. Pinned by
`TestWindowUsesTheApplicationMenu`.

## Punctuation accelerators never fire on Windows
Windows matches a key press to an accelerator by virtual-key name: `=` is
`oem_plus`, `/` is `oem_2`, `[` is `oem_4`. An accelerator of `CmdOrCtrl+=`
parses, shows in the menu, and never fires. Native accelerators use letters,
digits and F-keys only (`TestNativeAcceleratorKeysArePortable`); a punctuation
shortcut is a spec `shortcut`, handled by the page.

## Native roles bind accelerators you did not write
Hide `⌘H`, Hide Others `⌥⌘H`, Quit `⌘Q`, Close Window `⌘W`, Minimise `⌘M`,
Full Screen `⌃⌘F`. They are invisible in the spec, so `RoleAccelerators` in
`internal/app/menu/spec.go` records them and the uniqueness test counts them.
**The `Delete` role binds bare Backspace** — never use it. **The Cut, Copy and
Paste roles** run `navigator.clipboard` scripts in the page on Windows and
`execCommand('paste')` on Linux; neither reaches a canvas, so those are
commands. Role labels come from the application `Name`, not from the spec.

## Menu shortcuts never reach the page as keys
A bound accelerator is consumed by the menu. Anything the menu binds is
handled as a `menu:command` and removed from every JS keymap — the canvas
keymap and CodeMirror's — or it runs twice or not at all.

## Menu.Update rebuilds the whole native menu
On Linux it clears and rebuilds GMenu without marshalling to the main thread.
Call it only when the menu's structure changed, inside `application.InvokeSync`.
`SetChecked` and `SetEnabled` reach native items on their own.

## Not yet verified at a running window
Every menu path passes its tests, but none has been exercised in a running
webview on macOS, Windows or Linux. Until someone has, treat a report that a
menu item or shortcut does nothing as a plausible bug, not user error.

## A stale Assets.car silently keeps the template icon
`Info.plist`'s `CFBundleIconName` resolves through `Assets.car`, which wins
over `CFBundleIconFile` (`icons.icns`) on current macOS. `Assets.car` is
compiled by Xcode's `actool` from an Icon Composer `.icon`; without Xcode it
cannot be rebuilt. Bava ships no `Assets.car` and no `CFBundleIconName`.
`wails3 update build-assets` rewrites the plists and restores the key if
`Assets.car` comes back or `config.yml` sets `cfBundleIconName` —
`TestNoAssetsCarShipsSoMacOSUsesTheIcns` catches either.

## `wails3 generate icons` takes one input for every platform
macOS and Windows need different masters (a squircle with margin, a full-bleed
square). Run it once per platform and pass an empty filename for the other
output — an empty `-windowsfilename ""` skips that platform.

## The macOS title bar draws over the page
`MacTitleBarHiddenInset` sets `FullSizeContent`, so the traffic lights sit on
top of the webview's top-left corner. Nothing in Wails reserves that space; the
title bar does, through `--size-titlebar-inset-start`, set only under
`:root[data-platform='darwin']`.

## Only Windows aligns a tab in a menu label
`Label\tHint` right-aligns the hint on Windows. macOS and GTK print the tab as
spacing, so the hint lands mid-row — found at a running window. Hints go in
labels on Windows only. On macOS, a punctuation shortcut without Shift or
Option can be a real accelerator (spec `nativeOn: ["darwin"]`), which AppKit
aligns and matches by character; the page's matcher must then stand down.

## The build assets ship with template metadata
`build/config.yml`, both `Info.plist` files, the Linux `.desktop` file and the
Windows `info.json`, NSIS and MSIX files all said "My Product". macOS shows
`CFBundleName` as the application menu's title. Pinned by
`TestPackagingMetadataIsNotTheWailsTemplate`.

## A release build discards every log line
`pkg/application/logger_prod.go` makes the production `DefaultLogger` write to
`io.Discard`. Bava passes its session logger as `Options.Logger`; without that,
nothing Wails reports in a shipped app is kept.

## The default PanicHandler exits the process
`defaultPanicHandler` calls `fatal`, which calls `os.Exit(1)`. Panics inside
bound methods are already turned into a rejected call (beta.20, "#5037"), but
a panic anywhere else closed the app without a word. Bava's
`app.PanicHandler` logs, emits `app:error`, and does not exit — except:

- **Inside `InvokeSync*`** (`mainthread.go`): `wg.Done()` is not deferred, so a
  handler that returns leaves the caller blocked forever. Bava logs and exits.
- **Window-event and event hooks** are not recovered by Wails; a panic there
  ends the process. The next launch reports it through the session marker.

## Wails logs bound-call arguments at debug level
`messageprocessor_call.go` logs `"Binding call complete:"` with the full JSON
arguments and result — a whole document for `Save`. Never hand Wails a logger
that records debug, or one that records attribute values.

## Webview crash events are macOS-only
beta.20 exposes `mac:WebViewWebContentProcessDidTerminate` and no equivalent
for WebView2 or WebKitGTK. On Windows and Linux a dead content process still
leaves a blank window. Re-check at every Wails bump.
