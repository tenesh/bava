# Release, decisions

Settled with the user, one question at a time, before the move to
Tharabyte and the store work.

### 1. Bava ships through the stores only (2026-10-11)

The Mac App Store, the Microsoft Store and Flathub, each of which updates
the app. No direct downloads, no updater, no update check (`docs/decisions.md`,
CLAUDE.md non-negotiable 1).

### 2. The repository moves to `tharabyte/bava` (2026-10-11)

The user transfers it on GitHub. The Go module becomes
`github.com/tharabyte/bava`: a module name must start with a host, and the
GitHub name needs nothing else to resolve (a `tharabyte.com/bava` name
would need a page on the website for Go to follow).

### 3. The app ID is `com.tharabyte.bava` (2026-10-11)

What macOS, Windows and Flathub know the app by; it never changes after the
first release. Reverse-domain of `tharabyte.com`, which the user owns
(Flathub checks it). Chosen over `com.tharabyte.Bava`.

### 4. The publisher is Tharabyte (2026-10-11)

In About boxes, installer details, the stores' listings and the copyright
line, "© 2026 Tharabyte". `NOTICE` reads "Copyright 2026 Tharabyte",
replacing "Bava contributors".

### 5. An AI disclosure: AI-assisted, human-reviewed (2026-10-11)

A file at the repository's root says that code, tests and documents are
written with an AI assistant (Claude, by Anthropic) under a maintainer's
direction; that every change is reviewed, tested and committed by a
person, who is responsible for it; and what Bava itself does with AI: only
the endpoints the user sets up, with the credentials they supply, nothing
of ours. Chosen over "mostly AI-written" and over covering only the app's
own AI features.

### 6. No studies of other apps, and no other apps' names (2026-10-11)

The studies under `.claude/work/specs/research/` are deleted, and every
document, plan, rule, test and comment that names another product as a
comparison or a source (design, note and diagram apps, browsers' own
features) says what Bava does in its own words instead. A rule keeps it so.
What stays: the names of what Bava is built on and runs on (its
dependencies, the operating systems, their webviews and stores, file
formats and standards), since those name parts of Bava, not comparisons.
The history is kept as it is (decided 2026-10-11): it holds ordinary
comparison and study, the repository was already public, and a rewrite
changes every commit's id. Code adapted from another project, if any, is
attributed in `NOTICE` as its licence requires.

### 7. Adapted code: attributed now, written afresh in R1c (2026-10-11)

A function-by-function comparison found parts of the canvas adapted from
another project's MIT-licensed code; the rest is Bava's own or shares only
values and behaviour, which the licence does not cover. `NOTICE` carries
that project's copyright and licence, naming the files. R1c, right after
R1, replaces each adapted part with code written from a spec of Bava's own
behaviour (the tests and pictures as the check), never from the original;
the attribution is removed with the last of it. Chosen over attributing
only and over rewriting before attributing.
