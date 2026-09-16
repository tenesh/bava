# Updates

## The update check is the only call no user action triggers
That makes it the sharpest edge in the product, and it is held to a promise:
it fetches public release metadata, sends no user data, and carries no
identifier.

No unique install id. No version string in a query parameter — that is a usage
counter wearing a disguise. No telemetry riding along with the check. The
request shape is pinned by a test, because this is the one place where a small
convenient addition silently turns Bava into something that reports on its
users.

## Releases are static, not a service
Public release metadata from a static host. Nothing we operate holds state
about who checked, when, or from where.

## Auto-check is a setting, and the user can turn it off
Off means off: no check on launch, no check in the background, no "just once to
be helpful".

## Signatures are verified before anything is applied
An updater that downloads and executes without verifying what it fetched is a
remote code execution feature. Verify, then apply.
