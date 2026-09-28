// Package web reads a web page's details for a card: its title,
// description, icon and picture. It is the one place Bava fetches a page,
// and only when the user pastes a link or asks for its details again.
//
// Every fetch is bounded: http and https only, a few redirects, the start of
// the page, small pictures of picture types. It sends no cookies and no
// identifier: its User-Agent is "Bava", with no version.
package web

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"strings"
	"syscall"
	"time"
	"unicode/utf8"

	"golang.org/x/net/html"
)

// Timeout is the longest a whole fetch takes, pictures included.
var Timeout = 8 * time.Second

// Limits on every fetch.
const (
	// MaxRedirects is how many times a page may send the fetch elsewhere.
	MaxRedirects = 5
	// MaxPage is how much of a page is read: its head is at the start.
	MaxPage = 1 << 20
	// MaxPicture is the largest icon or picture kept.
	MaxPicture = 2 << 20
)

// UserAgent is sent with every fetch, and nothing else about the user.
const UserAgent = "Bava"

// pictureTypes are the pictures kept, by type, with the extension they are
// saved with.
var pictureTypes = map[string]string{
	"image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp",
	"image/svg+xml": ".svg", "image/x-icon": ".ico", "image/vnd.microsoft.icon": ".ico",
}

// Picture is an icon or a picture, with the extension its type is saved with.
type Picture struct {
	Data []byte
	Ext  string
}

// Details are what a card shows of a web page. A picture that could not be
// fetched is nil; the page's details stand without it.
type Details struct {
	Title       string
	Description string
	Icon        *Picture
	Image       *Picture
}

// newClient follows a few redirects, on the web only, and keeps no cookies.
// Unless the pasted page is itself on a private network (an intranet),
// nothing it names or redirects to may reach one: a page on the web cannot
// send Bava into the user's own network.
func newClient(allowPrivate bool) *http.Client {
	dialer := &net.Dialer{
		Control: func(_, address string, _ syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				return err
			}
			if ip := net.ParseIP(host); !allowPrivate && (ip == nil || isPrivate(ip)) {
				return fmt.Errorf("refused: %s is on a private network", host)
			}
			return nil
		},
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DialContext = dialer.DialContext
	transport.Proxy = nil
	return &http.Client{
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= MaxRedirects {
				return errors.New("too many redirects")
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return fmt.Errorf("redirected to %s", req.URL.Scheme)
			}
			return nil
		},
	}
}

// isPrivate reports an address on the user's own machine or network.
func isPrivate(ip net.IP) bool {
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified()
}

// pagePrivate reports whether a pasted page's host is on a private network;
// a host that cannot be looked up counts as on the web.
var pagePrivate = func(ctx context.Context, host string) bool {
	if ip := net.ParseIP(host); ip != nil {
		return isPrivate(ip)
	}
	ips, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
	if err != nil {
		return false
	}
	for _, ip := range ips {
		if isPrivate(ip) {
			return true
		}
	}
	return false
}

// get fetches an address on the web, as Bava does: no cookies, the plain
// User-Agent.
func get(ctx context.Context, client *http.Client, address *url.URL) (*http.Response, error) {
	if address.Scheme != "http" && address.Scheme != "https" {
		return nil, fmt.Errorf("not a web address: %s", address.Scheme)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, address.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", UserAgent)
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if res.StatusCode != http.StatusOK {
		res.Body.Close()
		return nil, fmt.Errorf("the site answered %s", res.Status)
	}
	return res, nil
}

// Fetch reads a web page's details, and (`pictures`) fetches its icon and
// picture; without, it asks the site for the page alone.
func Fetch(ctx context.Context, address string, pictures bool) (Details, error) {
	ctx, cancel := context.WithTimeout(ctx, Timeout)
	defer cancel()
	page, err := url.Parse(address)
	if err != nil || page.Host == "" {
		return Details{}, fmt.Errorf("not a web address: %q", address)
	}
	client := newClient(pagePrivate(ctx, page.Hostname()))
	res, err := get(ctx, client, page)
	if err != nil {
		return Details{}, err
	}
	defer res.Body.Close()
	kind, _, _ := mime.ParseMediaType(res.Header.Get("Content-Type"))
	if kind != "text/html" && kind != "application/xhtml+xml" {
		return Details{}, fmt.Errorf("not a web page: %s", kind)
	}
	head := readHead(io.LimitReader(res.Body, MaxPage))
	// Addresses in the page are relative to where it ended up.
	base := res.Request.URL
	details := Details{Title: head.title(), Description: head.description()}
	if !pictures {
		return details, nil
	}
	if icon := head.icon(); icon != "" {
		details.Icon = picture(ctx, client, base, icon)
	} else {
		details.Icon = picture(ctx, client, base, "/favicon.ico")
	}
	if image := head.meta["og:image"]; image != "" {
		details.Image = picture(ctx, client, base, image)
	}
	return details, nil
}

// picture fetches a picture the page names; nil when it is not one, or too big.
func picture(ctx context.Context, client *http.Client, base *url.URL, ref string) *Picture {
	address, err := base.Parse(ref)
	if err != nil {
		return nil
	}
	res, err := get(ctx, client, address)
	if err != nil {
		return nil
	}
	defer res.Body.Close()
	kind, _, _ := mime.ParseMediaType(res.Header.Get("Content-Type"))
	ext, ok := pictureTypes[kind]
	if !ok {
		return nil
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, MaxPicture+1))
	if err != nil || len(data) == 0 || len(data) > MaxPicture {
		return nil
	}
	return &Picture{Data: data, Ext: ext}
}

// head is what a page's head says of it.
type head struct {
	titleText string
	meta      map[string]string
	icons     map[string]string
}

// readHead reads a page's head: its title, its meta tags by name or
// property, and its icons by rel. It stops at the body.
func readHead(r io.Reader) head {
	h := head{meta: map[string]string{}, icons: map[string]string{}}
	z := html.NewTokenizer(r)
	inTitle := false
	var title bytes.Buffer
	for {
		switch z.Next() {
		case html.ErrorToken:
			h.titleText = title.String()
			return h
		case html.TextToken:
			if inTitle {
				title.Write(z.Text())
			}
		case html.EndTagToken:
			name, _ := z.TagName()
			switch string(name) {
			case "title":
				inTitle = false
			case "head":
				h.titleText = title.String()
				return h
			}
		case html.StartTagToken, html.SelfClosingTagToken:
			name, _ := z.TagName()
			attrs := attributes(z)
			switch string(name) {
			case "title":
				inTitle = true
			case "body":
				h.titleText = title.String()
				return h
			case "meta":
				key := strings.ToLower(attrs["property"])
				if key == "" {
					key = strings.ToLower(attrs["name"])
				}
				if _, seen := h.meta[key]; key != "" && !seen {
					h.meta[key] = attrs["content"]
				}
			case "link":
				rel := strings.ToLower(attrs["rel"])
				if _, seen := h.icons[rel]; strings.Contains(rel, "icon") && attrs["href"] != "" && !seen {
					h.icons[rel] = attrs["href"]
				}
			}
		}
	}
}

func attributes(z *html.Tokenizer) map[string]string {
	out := map[string]string{}
	for {
		key, value, more := z.TagAttr()
		if len(key) > 0 {
			out[strings.ToLower(string(key))] = string(value)
		}
		if !more {
			return out
		}
	}
}

func (h head) title() string {
	if t := clean(h.meta["og:title"], 300); t != "" {
		return t
	}
	return clean(h.titleText, 300)
}

func (h head) description() string {
	if d := clean(h.meta["og:description"], 500); d != "" {
		return d
	}
	return clean(h.meta["description"], 500)
}

// icon is the page's own icon: a plain one first, else the one for phones.
func (h head) icon() string {
	for _, rel := range []string{"icon", "shortcut icon"} {
		if href := h.icons[rel]; href != "" {
			return href
		}
	}
	for rel, href := range h.icons {
		if !strings.Contains(rel, "mask") {
			return href
		}
	}
	return ""
}

// clean is text as a card shows it: one line, spaces run together, at most
// max characters, valid UTF-8.
func clean(text string, max int) string {
	text = strings.Join(strings.Fields(strings.ToValidUTF8(text, "")), " ")
	if utf8.RuneCountInString(text) > max {
		text = string([]rune(text)[:max])
	}
	return text
}
