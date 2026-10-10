package space

import (
	"encoding/json"
	"path"
	"regexp"
	"sort"
	"strings"
	"unicode"

	"github.com/tenesh/bava/internal/format"
)

// MaxHits is how many results a search returns; more are only counted.
const MaxHits = 50

// snippetRunes is about how long a result's best line is shown.
const snippetRunes = 80

// Where a result's best match is.
const (
	InName     = "name"
	InDocument = "document"
	InCanvas   = "canvas"
)

// OpenPage is the page open in the window, with what it holds now: searched
// in place of its file, so unsaved words are found. Source is its Document's
// text (front matter included, no canvas block) and Scene its Canvas.
type OpenPage struct {
	Path   string       `json:"path"`
	Source string       `json:"source"`
	Scene  format.Scene `json:"scene"`
}

// Match is where a result is best shown.
type Match struct {
	// Where is InName, InDocument or InCanvas.
	Where string `json:"where"`
	// Text is the line or the element's text, cut around the match; empty
	// for a name.
	Text string `json:"text"`
	// Word is the typed word the text holds first, lowered.
	Word string `json:"word"`
	// Occurrence counts the times Word appears in the page's Document before
	// this match, capitals ignored, as find in a page counts.
	Occurrence int `json:"occurrence"`
	// Element is the canvas element holding the match.
	Element string `json:"element"`
}

// Hit is one page or folder a search found.
type Hit struct {
	Kind   string `json:"kind"`
	Path   string `json:"path"`
	Name   string `json:"name"`
	Folder string `json:"folder"`
	// Count is every time any typed word appears in the name, the Document
	// and the Canvas.
	Count int   `json:"count"`
	Best  Match `json:"best"`

	byName bool
	order  int
}

// Search finds the Space's folders and pages holding every word of the
// query, capitals ignored, a word matching the start of longer words. It
// reads names, each page's Document and its Canvas's text; templates, the
// Trash and anything hidden are not searched. Names come first, then pages
// by their count of matches, then the tree's order; at most MaxHits, with
// more reporting whether there were others.
func (s Space) Search(query string, open *OpenPage) (hits []Hit, more bool, err error) {
	words := queryWords(query)
	if len(words) == 0 {
		return nil, false, nil
	}
	order := 0
	var walk func(folder string) error
	walk = func(folder string) error {
		entries, err := s.List(folder)
		if err != nil {
			return err
		}
		for _, e := range entries {
			order++
			if e.Kind == KindFolder {
				name := path.Base(e.Path)
				if holdsAll(name, words) {
					hits = append(hits, Hit{Kind: KindFolder, Path: e.Path, Name: name, Folder: parentOf(e.Path),
						Count: countAll(name, words), Best: Match{Where: InName}, byName: true, order: order})
				}
				// A folder that cannot be read is passed over, as Pages does:
				// its pages are missing from the results, never the search.
				_ = walk(e.Path)
				continue
			}
			var prose string
			var scene format.Scene
			if open != nil && open.Path == e.Path {
				prose, scene = open.Source, open.Scene
			} else {
				source, err := s.ReadPage(e.Path)
				if err != nil {
					continue
				}
				file, _ := format.Read(source)
				prose, scene = format.Prose(source), file.Scene
			}
			if hit, ok := searchPage(e.Path, prose, scene, words); ok {
				hit.order = order
				hits = append(hits, hit)
			}
		}
		return nil
	}
	if err := walk(""); err != nil {
		return nil, false, err
	}
	sort.SliceStable(hits, func(i, j int) bool {
		a, b := hits[i], hits[j]
		if a.byName != b.byName {
			return a.byName
		}
		if a.byName {
			if (a.Kind == KindFolder) != (b.Kind == KindFolder) {
				return a.Kind == KindFolder
			}
			return a.order < b.order
		}
		if a.Count != b.Count {
			return a.Count > b.Count
		}
		return a.order < b.order
	})
	if len(hits) > MaxHits {
		return hits[:MaxHits], true, nil
	}
	return hits, false, nil
}

// searchPage matches one page: its name, its Document's lines and its
// Canvas's texts together must hold every word. All matching is done in
// characters on a lowered copy, so a letter whose lowercase takes another
// number of bytes (the Kelvin sign, a Turkish dotted I) cannot shift where
// the original is cut.
func searchPage(rel, prose string, scene format.Scene, words [][]rune) (Hit, bool) {
	name := pageTitle(rel)
	lines := plainLines(prose)
	texts := canvasTexts(scene)

	all := append([]string{name}, lines...)
	all = append(all, textsOf(texts)...)
	whole := strings.Join(all, "\n")
	if !holdsAll(whole, words) {
		return Hit{}, false
	}
	hit := Hit{Kind: KindPage, Path: rel, Name: name, Folder: parentOf(rel), Count: countAll(whole, words)}
	hit.byName = holdsAll(name, words)

	if line := bestOf(lines, words); line >= 0 {
		word, at := firstWord(lines[line], words)
		// Where the match sits in the Document, counted in characters across
		// its lines, to count the word's appearances before it as find does.
		before := 0
		for _, l := range lines[:line] {
			before += len([]rune(l)) + 1
		}
		document := lower(strings.Join(lines, "\n"))
		hit.Best = Match{Where: InDocument, Text: cut(lines[line], at), Word: string(word),
			Occurrence: occurrences(document[:before+at], word)}
	} else if element := bestOf(textsOf(texts), words); element >= 0 {
		word, at := firstWord(texts[element].text, words)
		hit.Best = Match{Where: InCanvas, Text: cut(texts[element].text, at), Word: string(word), Element: texts[element].id}
	} else {
		hit.Best = Match{Where: InName}
	}
	return hit, true
}

type canvasText struct{ id, text string }

// canvasTexts is the text of each canvas element that has any, in the
// scene's order: a shape's, arrow's, frame's or group's label, a text
// element's text, a code block's code, each on one line. Lines and pen
// strokes carry none, as find on the Canvas reads them.
func canvasTexts(scene format.Scene) []canvasText {
	var out []canvasText
	for _, e := range scene.Elements {
		if e.Type == "line" || e.Type == "stroke" {
			continue
		}
		var words struct {
			Label string `json:"label"`
			Text  string `json:"text"`
			Code  string `json:"code"`
		}
		if json.Unmarshal(e.Raw, &words) != nil {
			continue
		}
		text := strings.Join(strings.Fields(strings.Join([]string{words.Label, words.Text, words.Code}, " ")), " ")
		if text != "" {
			out = append(out, canvasText{id: e.ID, text: text})
		}
	}
	return out
}

func textsOf(texts []canvasText) []string {
	out := make([]string, len(texts))
	for i, t := range texts {
		out[i] = t.text
	}
	return out
}

// queryWords is the query split on spaces, each word lowered.
func queryWords(query string) [][]rune {
	var out [][]rune
	for _, w := range strings.Fields(query) {
		out = append(out, lower(w))
	}
	return out
}

// lower is text lowered letter by letter, keeping one character for each:
// indexes into it are indexes into the original's characters.
func lower(text string) []rune {
	runes := []rune(text)
	for i, r := range runes {
		runes[i] = unicode.ToLower(r)
	}
	return runes
}

// bestOf is the line holding the most of the words, the earliest on a tie,
// or -1 when none holds any.
func bestOf(lines []string, words [][]rune) int {
	best, most := -1, 0
	for i, l := range lines {
		text, n := lower(l), 0
		for _, w := range words {
			if wordAt(text, w, 0) >= 0 {
				n++
			}
		}
		if n > most {
			best, most = i, n
		}
	}
	return best
}

// firstWord is the typed word appearing earliest in the line, and the
// character where it starts.
func firstWord(line string, words [][]rune) ([]rune, int) {
	text := lower(line)
	var word []rune
	at := -1
	for _, w := range words {
		if i := wordAt(text, w, 0); i >= 0 && (at < 0 || i < at) {
			word, at = w, i
		}
	}
	return word, at
}

// holdsAll reports whether text holds every word at the start of a word.
func holdsAll(text string, words [][]rune) bool {
	lowered := lower(text)
	for _, w := range words {
		if wordAt(lowered, w, 0) < 0 {
			return false
		}
	}
	return true
}

// countAll counts every place any of the words starts a word in text.
func countAll(text string, words [][]rune) int {
	lowered := lower(text)
	n := 0
	for _, w := range words {
		for at := wordAt(lowered, w, 0); at >= 0; at = wordAt(lowered, w, at+len(w)) {
			n++
		}
	}
	return n
}

// wordAt is the character where word starts a word of text, from `from`
// on (both lowered), or -1.
func wordAt(text, word []rune, from int) int {
	for at := runeIndex(text, word, from); at >= 0; at = runeIndex(text, word, at+1) {
		if at == 0 || !isWordRune(text[at-1]) {
			return at
		}
	}
	return -1
}

// occurrences counts word anywhere in text, as find in a page counts it.
func occurrences(text, word []rune) int {
	n := 0
	for at := runeIndex(text, word, 0); at >= 0; at = runeIndex(text, word, at+len(word)) {
		n++
	}
	return n
}

// runeIndex is the first character from `from` on where word appears in text,
// or -1.
func runeIndex(text, word []rune, from int) int {
	if len(word) == 0 {
		return -1
	}
	for at := max(from, 0); at+len(word) <= len(text); at++ {
		match := true
		for i, r := range word {
			if text[at+i] != r {
				match = false
				break
			}
		}
		if match {
			return at
		}
	}
	return -1
}

func isWordRune(r rune) bool { return unicode.IsLetter(r) || unicode.IsDigit(r) }

// cut keeps about snippetRunes of a line around the character where its
// match starts, marking what was left out with an ellipsis.
func cut(line string, at int) string {
	runes := []rune(line)
	if len(runes) <= snippetRunes {
		return line
	}
	start := max(0, at-snippetRunes/3)
	end := min(len(runes), start+snippetRunes)
	start = max(0, end-snippetRunes)
	out := strings.TrimSpace(string(runes[start:end]))
	if start > 0 {
		out = "…" + out
	}
	if end < len(runes) {
		out += "…"
	}
	return out
}

func parentOf(rel string) string {
	if dir := path.Dir(rel); dir != "." {
		return dir
	}
	return ""
}

var (
	frontMatter = regexp.MustCompile(`\A---\r?\n[\s\S]*?\r?\n---\r?\n`)
	htmlComment = regexp.MustCompile(`<!--[\s\S]*?-->`)
	htmlTag     = regexp.MustCompile(`</?[A-Za-z][^>]*>`)
	image       = regexp.MustCompile(`!\[([^\]]*)\]\([^)]*\)`)
	link        = regexp.MustCompile(`\[([^\]]*)\]\([^)]*\)`)
	footnoteRef = regexp.MustCompile(`\[\^[^\]]*\]:?`)
	calloutKind = regexp.MustCompile(`^\[![A-Za-z]+\]\s*`)
	blockMarker = regexp.MustCompile(`^(?:#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|[a-zA-Z][.)]\s+)`)
	emphasis    = regexp.MustCompile("\\*\\*|__|~~|`|\\*|\\$\\$|\\$")
	tableRule   = regexp.MustCompile(`^\|?[\s:|-]+\|?$`)
	fence       = regexp.MustCompile("^(```|~~~)")
)

// plainLines is a page's Document as the reader sees it, one line per
// written line, blank lines left out: no front matter, no Markdown marks,
// a link's or image's words without its address, no HTML.
func plainLines(prose string) []string {
	prose = frontMatter.ReplaceAllString(prose, "")
	prose = htmlComment.ReplaceAllString(prose, "")
	var out []string
	for _, line := range strings.Split(prose, "\n") {
		line = strings.TrimSpace(strings.TrimRight(line, "\r"))
		if fence.MatchString(line) || tableRule.MatchString(line) {
			continue
		}
		for {
			next := blockMarker.ReplaceAllString(line, "")
			if next == line {
				break
			}
			line = next
		}
		line = calloutKind.ReplaceAllString(line, "")
		line = htmlTag.ReplaceAllString(line, "")
		line = image.ReplaceAllString(line, "$1")
		line = link.ReplaceAllString(line, "$1")
		line = footnoteRef.ReplaceAllString(line, "")
		line = emphasis.ReplaceAllString(line, "")
		line = strings.Join(strings.Fields(strings.ReplaceAll(line, "|", " ")), " ")
		if line != "" {
			out = append(out, line)
		}
	}
	return out
}
