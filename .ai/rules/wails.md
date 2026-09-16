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

## Cross-platform claims need CI
A successful `wails3 build` on macOS proves nothing about Windows or Linux.
The webviews differ — WKWebView, WebView2, WebKitGTK — and so do the build
toolchains. Never report "builds on all platforms" without a CI matrix result.

## Keep the native surface thin
File I/O, window management, menus, and the D2 pipeline. Everything else lives
in the frontend. The thinner this layer, the cheaper a shell swap would be if
the beta churn ever becomes untenable.