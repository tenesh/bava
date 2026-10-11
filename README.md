# Bava

A local-only desktop app for diagrams and documents. Offline, free and
file-based.

Each file holds a page and a canvas. On the canvas you place, draw and
connect anything, anywhere. A diagram can also be written as D2 code: Bava
lays it out once and turns it into ordinary shapes and arrows you then edit
freely.

- **Your files are the source of truth.** Pages and canvases are plain text
  on disk, readable and diffable in any editor.
- **No service of ours.** No accounts, no sync, no telemetry. Network calls
  happen only where you configure or trigger them.
- **Desktop only.** macOS, Linux and Windows.

Bava is under active development and not yet released.

## Building from source

Needs Go 1.27+, Node 24 and the [Wails v3](https://v3.wails.io/) CLI.

```
wails3 build
```

## Tests

```
go test ./internal/... .
cd frontend && npm test
```

Browser tests run in Docker (`npm run browser`); see
[`docs/testing.md`](docs/testing.md).

## Docs

- [`docs/file-format.md`](docs/file-format.md): what Bava writes to disk
- [`docs/shortcuts.md`](docs/shortcuts.md): keyboard shortcuts
- [`docs/decisions.md`](docs/decisions.md): decisions and why

## Licence

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
