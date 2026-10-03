package web

// In package web to reach pagePrivate, which decides whether a page is on
// the user's own network.

import (
	"context"
	"net/url"
	"testing"
)

// TreatAsPublic counts the host of address as on the web, not a private
// network, until the test ends.
func TreatAsPublic(t testing.TB, address string) {
	t.Helper()
	u, err := url.Parse(address)
	if err != nil {
		t.Fatal(err)
	}
	was := pagePrivate
	pagePrivate = func(ctx context.Context, host string) bool {
		if host == u.Hostname() {
			return false
		}
		return was(ctx, host)
	}
	t.Cleanup(func() { pagePrivate = was })
}
