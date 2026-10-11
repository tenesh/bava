# AI disclosure

Bava is built with help from generative AI. This file says where AI is
used, roughly how much, and what a person does. It is kept up to date with
the project.

## The tool

Claude, by Anthropic: through Claude Code for the code, tests and
documents, and on claude.ai for the design system and mockups.

## What is AI-assisted

| Part | Extent |
|---|---|
| Application code (Go, Svelte and TypeScript) and its tests | Most of it is written by Claude, to specs and plans the maintainer approves |
| Build, packaging and CI configuration (task files, workflows, scripts, platform files) | Started from the Wails project template, then trimmed and extended by Claude; the Flatpak manifest is excluded (below) |
| Documentation, specs, decisions and project rules | Most of it is drafted by Claude in discussion with the maintainer |
| The design system and mockups | Created with Claude, directed and reviewed by the maintainer |
| Research (libraries, platform behaviour, store policies) | Done with Claude; it informs decisions but is not shipped |

## What a person does

- The maintainer makes every product and technical decision. Each one is
  recorded in `docs/decisions.md`.
- The maintainer reads every change and makes every commit. Claude never
  commits, pushes or tags.
- Every behaviour gets tests written before the code. Every change is
  checked against the project's rules by Claude review agents, whose
  findings the maintainer reads before committing. The maintainer is
  responsible for what ships.

## What is not AI-assisted

- **The Flathub manifest and everything in the Flathub submission**: the
  pull request, its description, commit messages and replies to reviewers.
  Flathub's policy requires this, and Bava follows it.

## Bava's own AI features

Bava's AI features are not built yet. When they are, Bava talks only to the
AI endpoint you choose, local or hosted, with the credentials you supply;
it has no AI service of its own, and nothing about you or your work reaches
anyone operating this project. This section will describe them when they
ship.
