package web

import (
	"context"
	"net/url"
)

// TreatAsPublic counts the host of address as on the web, not a private
// network, until the returned function puts things back.
func TreatAsPublic(address string) func() {
	u, _ := url.Parse(address)
	was := pagePrivate
	pagePrivate = func(ctx context.Context, host string) bool {
		if host == u.Hostname() {
			return false
		}
		return was(ctx, host)
	}
	return func() { pagePrivate = was }
}
