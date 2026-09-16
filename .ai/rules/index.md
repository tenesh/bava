# Rules index

Committed, area-grouped rules: settled decisions, non-obvious traps, standing
constraints. Read every file whose globs cover the paths in scope before
writing code. A path match alone misses things — also run
`grep -rin '<keyword>' .ai/rules`.

Add new rules here as they are discovered. A rule earns a place when it is
durable (still true next month), non-obvious (a competent person would get it
wrong), and scoped (it belongs to some paths, not all).

| Rule file | Globs |
|---|---|
| `d2.md` | `internal/render/**`, `internal/layout/**`, `internal/compile/**` |
| `wails.md` | `main.go`, `internal/app/**`, `build/**` |
| `svelte.md` | `frontend/src/**/*.svelte`, `frontend/src/**/*.svelte.ts` |
| `design-system.md` | `frontend/src/components/**`, `frontend/src/styles/**` |
| `canvas.md` | `frontend/src/canvas/**` |
| `editors.md` | `frontend/src/editor/**`, `frontend/src/docs/**` |
| `file-format.md` | `internal/store/**`, `internal/format/**` |
| `ipc.md` | `internal/app/bindings*.go`, `frontend/src/ipc/**` |
| `testing.md` | `**/*_test.go`, `testdata/**` |

## Writing a rule file

Keep them short — a rule nobody reads is worse than no rule.

```markdown
# <Area>

## <Short title>
Two or three lines. What the rule is, and why. The "why" is what stops
someone reasoning their way around it six months later.
```