# Testing

Traps when writing tests. The standard and layers are in `docs/testing.md`.

## Goldens and references change only when looked at
`-update` and `npm run browser:update` are for an intended change: open every
new or changed SVG or PNG, list them in the report. Run goldens before and after
any D2, font or Wails bump. `.gitattributes` forces LF; never relax it.

## Test the path the app takes
Inject at the transport and `normalise` goes untested; supply what the app
computes and you test nothing about the app. One test per crossing comes the
app's way.

## Windows: close files, compare shapes, skip modes
Close every opened file, even in a crash test (`t.Cleanup`), or `t.TempDir`
fails. Compare paths with `filepath.FromSlash`. Permission tests skip on
Windows.

## Pictures
One sheet per family; a state the page can say is asserted as data first.
`maxDiffPixels: 0`, `threshold: 0.02`: never raise it to quiet a failure.
Forced states never rewrite inside `:not()`; selection is transparent.

## Headless WebKit lies about popovers and clicks
It can paint a popover's old state: assert `data-highlighted`/`data-state`.
Open submenus by keyboard. Selection-moving clicks use `{ delay: 50 }`.

## Browser stand-in and canvas walks
The stand-in returns what Go returns, error codes included. Canvas walks seed
scenes (`seedScene`, `openCanvas`) and assert `savedScene`, not pixels.

## End-to-end
A `file` step checks what reached disk. Native accelerators are `menu` steps.
`type` goes a character at a time, or typing shortcuts read it as a paste. The
driver ships only under `-tags e2e` and `VITE_BAVA_E2E=1`.
