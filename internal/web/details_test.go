package web_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/tenesh/bava/internal/web"
)

var png = []byte("\x89PNG\r\n\x1a\nfake")

// site serves a page and its pictures, recording what it was asked with.
func site(t *testing.T, page string, extra map[string]http.HandlerFunc) (*httptest.Server, *[]*http.Request) {
	t.Helper()
	var asked []*http.Request
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		asked = append(asked, r)
		if h, ok := extra[r.URL.Path]; ok {
			h(w, r)
			return
		}
		switch r.URL.Path {
		case "/post":
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			http.SetCookie(w, &http.Cookie{Name: "track", Value: "1"})
			_, _ = w.Write([]byte(page))
		case "/icon.png", "/pic.png", "/favicon.ico":
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(png)
		default:
			http.NotFound(w, r)
		}
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, &asked
}

func TestDetailsAreReadFromTheOpenGraphTags(t *testing.T) {
	srv, _ := site(t, `<html><head>
		<title>Plain title</title>
		<meta property="og:title" content="  Release   notes ">
		<meta property="og:description" content="How we ship &amp; why.">
		<meta property="og:image" content="/pic.png">
		<link rel="shortcut icon" href="icon.png">
		</head><body>ignored</body></html>`, nil)
	got, err := web.Fetch(context.Background(), srv.URL+"/post", true)
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Release notes" || got.Description != "How we ship & why." {
		t.Errorf("details = %+v", got)
	}
	if got.Icon == nil || string(got.Icon.Data) != string(png) || got.Icon.Ext != ".png" || got.Image == nil || got.Image.Ext != ".png" {
		t.Errorf("pictures = %+v %+v", got.Icon, got.Image)
	}
}

func TestDetailsFallBackToTheTitleDescriptionAndFavicon(t *testing.T) {
	srv, _ := site(t, `<head><title>Plain title</title><meta name="description" content="Short."></head>`, nil)
	got, err := web.Fetch(context.Background(), srv.URL+"/post", true)
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Plain title" || got.Description != "Short." || got.Icon == nil || got.Image != nil {
		t.Errorf("details = %+v", got)
	}
}

func TestFetchSendsNoCookieAndNoIdentifier(t *testing.T) {
	srv, asked := site(t, `<head><title>T</title><link rel="icon" href="/icon.png"></head>`, nil)
	if _, err := web.Fetch(context.Background(), srv.URL+"/post", true); err != nil {
		t.Fatal(err)
	}
	for _, r := range *asked {
		if r.Header.Get("Cookie") != "" || r.Header.Get("User-Agent") != "Bava" {
			t.Errorf("%s asked with cookie %q, user agent %q", r.URL.Path, r.Header.Get("Cookie"), r.Header.Get("User-Agent"))
		}
	}
}

func TestPicturesThatAreNotPicturesOrTooBigAreLeftOut(t *testing.T) {
	srv, _ := site(t, `<head><title>T</title><meta property="og:image" content="/big.png"><link rel="icon" href="/page.html"></head>`, map[string]http.HandlerFunc{
		"/big.png": func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(make([]byte, 3<<20))
		},
		"/page.html": func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write([]byte("<html>"))
		},
	})
	got, err := web.Fetch(context.Background(), srv.URL+"/post", true)
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "T" || got.Image != nil || got.Icon != nil {
		t.Errorf("details = %+v", got)
	}
}

func TestWhatCannotBeFetchedIsAnError(t *testing.T) {
	srv, _ := site(t, "", map[string]http.HandlerFunc{
		"/loop": func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, "/loop", http.StatusFound) },
		"/file": func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/pdf")
			_, _ = w.Write([]byte("%PDF"))
		},
	})
	cases := map[string]string{
		"a redirect loop":    srv.URL + "/loop",
		"a file, not a page": srv.URL + "/file",
		"a page not there":   srv.URL + "/missing",
		"another scheme":     "ftp://example.com/x",
		"a file on the disk": "file:///etc/passwd",
		"not an address":     "not an address",
	}
	for name, address := range cases {
		t.Run(name, func(t *testing.T) {
			if got, err := web.Fetch(context.Background(), address, true); err == nil {
				t.Errorf("%s gave details %+v", address, got)
			}
		})
	}
}

// Bava's own limit ends a fetch, not the caller's.
func TestFetchEndsAtItsOwnTimeout(t *testing.T) {
	srv, _ := site(t, "", map[string]http.HandlerFunc{
		// Never answers; returns once the fetch gives up.
		"/slow": func(_ http.ResponseWriter, r *http.Request) { <-r.Context().Done() },
	})
	was := web.Timeout
	web.Timeout = 50 * time.Millisecond
	t.Cleanup(func() { web.Timeout = was })

	_, err := web.Fetch(context.Background(), srv.URL+"/slow", true)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("a site that never answered: %v, want the deadline", err)
	}
}

// Only the page's first megabyte is read: a title past it is never seen.
func TestOnlyThePagesFirstMegabyteIsRead(t *testing.T) {
	srv, _ := site(t, "", map[string]http.HandlerFunc{
		"/huge": func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write([]byte("<html><head><!--" + strings.Repeat("x", 2<<20) + "--><title>Too far</title></head>"))
		},
	})
	if got, err := web.Fetch(context.Background(), srv.URL+"/huge", true); err != nil || got.Title != "" {
		t.Errorf("huge page = %+v, %v", got, err)
	}
}

func TestNoPicturesAreFetchedWhenNoneAreWanted(t *testing.T) {
	srv, asked := site(t, `<head><title>T</title><meta property="og:image" content="/pic.png"><link rel="icon" href="/icon.png"></head>`, nil)
	got, err := web.Fetch(context.Background(), srv.URL+"/post", false)
	if err != nil || got.Title != "T" || got.Icon != nil || got.Image != nil || len(*asked) != 1 {
		t.Errorf("details = %+v, %v; asked %d times", got, err, len(*asked))
	}
}

// A page on the web cannot send Bava into the user's own network: its
// pictures and redirects may not reach a private or loopback address.
func TestAPublicPageCannotReachThePrivateNetwork(t *testing.T) {
	srv, _ := site(t, `<head><title>T</title><meta property="og:image" content="/pic.png"><link rel="icon" href="/icon.png"></head>`, map[string]http.HandlerFunc{
		"/away": func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, "/post", http.StatusFound) },
	})
	web.TreatAsPublic(t, srv.URL)
	if _, err := web.Fetch(context.Background(), srv.URL+"/post", true); err == nil {
		t.Error("a page counted as public reached a loopback address")
	}
}
