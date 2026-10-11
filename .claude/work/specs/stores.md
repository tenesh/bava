# Stores and sandboxes, decisions

Settled with the owner one question at a time (R2). Bava ships through the
Mac App Store, the Microsoft Store and Flathub; the first and last sandbox
the app.

### 1. A loose page asks for its folder only when it needs it (2026-10-11)
A single page opens at once, with access to that file alone. If it shows
pictures or files from its folder, a quiet bar offers to allow access to
the folder, opening the system's folder dialog pointed at it; once allowed,
Bava remembers it. Chosen over always asking first and over opening every
page as a Space.

### 2. A Space Bava can no longer reach is offered to be found again (2026-10-11)
It stays in Recent, marked "Can't open". Choosing it opens the folder
dialog where it last was; picking the folder restores it. Remove takes it
off the list. Chosen over dropping it silently and over an error alone.

### 3. A file outside the Space is asked for once (2026-10-11)
Its card shows "Outside this Space". Opening it opens the system's file
dialog pointed at that file; once allowed, Bava remembers it. Nothing is
read unasked. Chosen over refusing outside files and over copying them in.

### 4. All three sandboxes are tested from R2 (2026-10-11)
Linux is tested inside the Flatpak sandbox from the start, alongside macOS
and Windows. Revised the same day: Claude writes a test-only manifest,
`tests/flatpak/bava-ci.yml` with the ID `com.tharabyte.bava.Devel`, used
only by CI and never submitted; the owner writes the Flathub manifest,
`com.tharabyte.bava.yml`, at submission, without copying it (Flathub's
rule, `.ai/rules/ai-disclosure.md`).

### 5. A picture Bava may not read yet waits, never "missing" (2026-10-11)
While a loose page's folder is not allowed, a picture or file it cannot
read says it is waiting for folder access, with no Relink; it draws once
allowed. "Missing" stays for files that are really gone. Chosen over
keeping the missing state under the bar.
