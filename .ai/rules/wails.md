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