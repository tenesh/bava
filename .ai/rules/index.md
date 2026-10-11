# Rules index

Before editing, read every rule file whose globs cover the paths in scope, then
`grep -rin '<keyword>' .ai/rules` for what a path match misses.
A new rule is durable, non-obvious and scoped: register it here, a heading and at most three lines.

| Rule file | Globs |
|---|---|
| `d2.md` | `internal/render/**`, `internal/layout/**` |
| `wails.md` | `main.go`, `internal/app/**`, `build/**` |
| `design-system.md` | `frontend/src/components/**`, `frontend/src/styles/**`, `frontend/src/i18n/**` |
| `canvas.md` | `frontend/src/canvas/**` |
| `editors.md` | `frontend/src/editor/**`, `frontend/src/docs/**` |
| `file-format.md` | `internal/store/**`, `internal/format/**`, `internal/space/**`, `internal/config/**`, `docs/file-format.md` |
| `ipc.md` | `internal/app/bindings*.go`, `internal/app/space*.go`, `internal/app/file*.go`, `internal/app/export*.go`, `internal/app/menu*.go`, `internal/web/**`, `frontend/src/ipc/**`, `frontend/src/files/**`, `frontend/src/shell/commands*.ts` |
| `testing.md` | `**/*_test.go`, `testdata/**`, `tests/**`, `frontend/tests/**`, `internal/e2e/**`, `frontend/src/e2e/**`, `**/*.test.ts`, `internal/testutil/**`, `frontend/src/test/**`, `frontend/src/test-setup.ts`, `frontend/src/docs/test-editor.ts`, `**/__fixtures__/**` |
| `ai.md` | `internal/ai/**`, `frontend/src/ai/**` (not built yet) |
| `logging.md` | `internal/logs/**`, `internal/app/log*.go`, `internal/app/recover*.go`, `internal/app/privacy*_test.go`, `main.go`, `frontend/src/ipc/log*.ts`, `frontend/src/shell/errors*` |
