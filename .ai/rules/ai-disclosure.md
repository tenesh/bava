# AI disclosure

## Claude never touches the Flathub manifest or submission
Flathub's policy: "Flathub manifests must not contain AI-generated or
AI-assisted content", and AI tools must not open or automate submission
pull requests, or write their commit messages, descriptions, review
comments or replies. So Claude does not write, edit, review or suggest
content for the Flatpak manifest (`com.tharabyte.bava.*`), in this
repository or in Flathub's, and takes no part in the submission. The
maintainer writes them from Flathub's documentation. Breaking this risks
rejection and, if repeated, a permanent ban. `.claude/settings.json` denies
editing the manifest (`com.tharabyte.bava.yml`, `.yaml`, `.json`) through
the editor; a shell write to it is just as forbidden.

## `AI-DISCLOSURE.md` stays true
It states which parts are AI-assisted and roughly how much. A change that
alters that picture (a new kind of content, a new tool, a part that stops
or starts being AI-assisted) updates the file in the same change. Flathub
requires disclosure of "the affected parts and approximate extent", and a
store reviewer may read this file.

## Bava's own AI features are the user's
Bava talks only to the AI endpoints the user sets up, with the credentials
they supply; nothing of ours. When those features are built, the
disclosure's last section, the stores' listings and their privacy answers
describe them in the same change.
