# Wails

Traps in Wails v3 beta and the native shell.

## v3 beta only, pinned
`v3/pkg/application` only; never v2 `runtime` or the alpha docs
(`v3alpha.wails.io`). The tag is pinned in `go.mod`; never float it.

## No vendored docs
Context7 and upstream serve the latest, maybe ahead of the pin. When they
disagree with the code, read the pinned source:
`go list -m -f '{{.Dir}}' github.com/wailsapp/wails/v3`.

## Build the frontend before any Go command
`main.go` embeds `all:frontend/dist`, which is gitignored. On a clean checkout
every Go build fails with `pattern all:frontend/dist: no matching files found`.
A stale local `dist/` hides it.

## Linux is GTK4, not GTK3
Install `libgtk-4-dev libwebkitgtk-6.0-dev libsoup-3.0-dev libglib2.0-dev`.
GTK3 is opt-in behind the `gtk3` tag. `wails3 doctor` lists both variants'
packages; the build tags are the authority.

## Cross-platform claims need CI
A macOS build proves nothing about Windows or Linux. Never claim "builds
everywhere" without a CI matrix result.

## Keep the native surface thin
Go holds file I/O, Spaces, windows, menus, D2, logs, the clipboard image
(`FileService.ClipboardImage`) and the one web fetch. Everything else is
frontend.

## Menu role items need a running application
`AddRole` panics outside a running app. Build menus after `application.New`;
in tests pass `menu.Options{AddRole: …}` a no-op.

## Windows needs `UseApplicationMenu`
It defaults to false and Windows does not fall back to the app menu, so
without it there is no menu bar (`TestWindowUsesTheApplicationMenu`).

## Native accelerators: letters, digits, F-keys only
Windows matches by virtual-key name, so `CmdOrCtrl+=` shows but never fires.
A punctuation shortcut is a spec `shortcut` handled by the page
(`TestNativeAcceleratorKeysArePortable`).

## Native roles bind keys you did not write
Hide, Hide Others, Quit, Close Window, Minimise, Full Screen: recorded in
`RoleAccelerators` (`internal/app/menu/spec.go`). **The `Delete` role binds
bare Backspace: never use it.** Cut, Copy and Paste roles never reach a canvas,
so those are commands.

## Menu shortcuts never reach the page as keys
A bound accelerator is consumed by the menu. Handle it as `menu:command` and
remove it from every JS keymap, or it runs twice or not at all.

## Native menus change on the main thread only
macOS AppKit menus crash when changed off the main thread. Every change from a
bound call goes through `application.InvokeSync` (`MenuService.onMain`).
`Menu.Update` rebuilds the whole menu: only on structural change.

## Native menus are unverified on Windows and Linux
CI dispatches `menu:command` in the page, never a native item or key. A report
there that a menu item does nothing is a plausible bug.

## A stale Assets.car keeps the template icon
`CFBundleIconName` resolves through `Assets.car` and wins over `icons.icns`.
Bava ships neither; `wails3 update build-assets` can restore the key
(`TestNoAssetsCarShipsSoMacOSUsesTheIcns`).

## `wails3 generate icons` takes one input for every platform
macOS and Windows need different masters: run once per platform, passing an
empty filename (`-windowsfilename ""`) to skip the other.

## The macOS title bar draws over the page
`MacTitleBarHidden` puts the traffic lights over the webview; the title bar
reserves room with `--size-titlebar-inset-start` under
`:root[data-platform='darwin']`.

## Only Windows aligns a tab in a menu label
`Label\tHint` hints go in labels on Windows only. On macOS a punctuation key
without Shift or Option may be native (`nativeOn: ["darwin"]`), and the page's
matcher must stand down.

## Build assets ship with template metadata
`config.yml`, the plists, `.desktop`, `info.json`, NSIS and MSIX all said
"My Product" (`TestPackagingMetadataIsNotTheWailsTemplate`).

## Release builds discard Wails' logs
The production `DefaultLogger` writes to `io.Discard`; Bava passes
`Options.Logger`. Wails logs bound-call arguments at debug, so never give it a
logger that records debug or attribute values.

## The default PanicHandler exits
Bava's `app.PanicHandler` logs, emits `app:error` and carries on, except inside
`InvokeSync*` (the caller would block forever, so it exits). Window-event and
event hooks are not recovered; the next launch reports via the session marker.

## Webview crash events are macOS-only
Only `mac:WebViewWebContentProcessDidTerminate` exists; Windows and Linux show
a blank window. Re-check at every Wails bump.

## Shutdown runs in more than one place
On macOS `Run` never returns: shutdown belongs in `Options.PostShutdown` or
`OnShutdown` (`TestPostShutdownClosesTheSession`). On Windows the last window
skips both and `Run` returns, so repeat it after `Run`, idempotently.

## Files reach the page through the asset server
Never base64 through a bound call. `/bava-file/` (`app.FileRoute`) checks each
request against `app.OpenedFolders`; new file kinds go through it. Wails'
clipboard reads text only.

## PDF printing reaches into Wails on Windows
`internal/pdfprint` reads unexported `WebviewWindow.impl` and its `chromium`
to call `Page.printToPDF`. At every Wails bump, CI's `export-proof` walk is the
check.
