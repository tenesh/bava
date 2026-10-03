# Rules index

Committed, area-grouped rules: settled decisions, non-obvious traps, standing
constraints. Read every file whose globs cover the paths in scope before
writing code. A path match alone misses things; also run
`grep -rin '<keyword>' .ai/rules`.

Add new rules here as they are discovered. A rule earns a place when it is
durable (still true next month), non-obvious (a competent person would get it
wrong), and scoped (it belongs to some paths, not all).

| Rule file | Globs |
|---|---|
| `d2.md` | `internal/render/**`, `internal/layout/**` |
| `wails.md` | `main.go`, `internal/app/**`, `build/**` |
| `svelte.md` | `frontend/src/**/*.svelte`, `frontend/src/**/*.svelte.ts` |
| `design-system.md` | `frontend/src/components/**`, `frontend/src/styles/**`, `frontend/src/i18n/**` |
| `canvas.md` | `frontend/src/canvas/**` |
| `editors.md` | `frontend/src/editor/**`, `frontend/src/docs/**` |
| `file-format.md` | `internal/store/**`, `internal/format/**`, `internal/space/**`, `internal/config/**`, `docs/file-format.md` |
| `ipc.md` | `internal/app/bindings*.go`, `internal/app/space*.go`, `internal/app/file*.go`, `internal/app/export*.go`, `internal/app/menu*.go`, `internal/web/**`, `frontend/src/ipc/**`, `frontend/src/files/**`, `frontend/src/shell/commands*.ts` |
| `testing.md` | `**/*_test.go`, `testdata/**`, `tests/**`, `frontend/tests/**`, `internal/e2e/**`, `frontend/src/e2e/**`, `**/*.test.ts`, `internal/testutil/**`, `frontend/src/test/**`, `frontend/src/test-setup.ts`, `frontend/src/docs/test-editor.ts`, `**/__fixtures__/**` |
| `ai.md` | `internal/ai/**`, `frontend/src/ai/**` (future paths: not built yet) |
| `updates.md` | `internal/update/**` (future path: not built yet) |
| `logging.md` | `internal/logs/**`, `internal/app/log*.go`, `internal/app/recover*.go`, `internal/app/privacy*_test.go`, `main.go`, `frontend/src/ipc/log*.ts`, `frontend/src/shell/errors*` |

## Writing a rule file

Keep them short: a rule nobody reads is worse than no rule.

```markdown
# <Area>

## <Short title>
Two or three lines. What the rule is, and why. The "why" is what stops
someone reasoning their way around it six months later.
```