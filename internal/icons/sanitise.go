// Package icons is the custom icon library: SVG files the user adds, kept in
// Bava's config folder for every Space, cleaned before the page draws them.
package icons

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
)

const (
	svgNamespace   = "http://www.w3.org/2000/svg"
	xlinkNamespace = "http://www.w3.org/1999/xlink"
)

// The elements a drawing is made of. Anything else is dropped with what it
// holds: scripts, animations, foreign content, another app's markup. A
// stylesheet is read for its class rules and never written out.
var drawingElements = map[string]bool{
	"svg": true, "g": true, "defs": true, "symbol": true, "use": true,
	"path": true, "rect": true, "circle": true, "ellipse": true, "line": true,
	"polyline": true, "polygon": true, "text": true, "tspan": true,
	"linearGradient": true, "radialGradient": true, "stop": true,
	"clipPath": true, "mask": true, "pattern": true, "marker": true,
	"title": true, "desc": true, "image": true,
}

// The attributes a drawing is made of, as SVG spells them. Anything else is
// dropped, so an attribute the page would read as an address or a script
// (`srcset`, an upper-case `ID`, a feature test) never gets through by
// being one nobody thought of.
var drawingAttributes = map[string]bool{
	"id": true, "x": true, "y": true, "x1": true, "y1": true, "x2": true, "y2": true,
	"cx": true, "cy": true, "r": true, "rx": true, "ry": true, "fx": true, "fy": true, "fr": true,
	"width": true, "height": true, "d": true, "points": true, "pathLength": true,
	"transform": true, "viewBox": true, "preserveAspectRatio": true,
	"fill": true, "fill-opacity": true, "fill-rule": true,
	"stroke": true, "stroke-width": true, "stroke-opacity": true, "stroke-linecap": true,
	"stroke-linejoin": true, "stroke-miterlimit": true, "stroke-dasharray": true, "stroke-dashoffset": true,
	"opacity": true, "color": true, "display": true, "visibility": true, "overflow": true,
	"clip-path": true, "clip-rule": true, "clipPathUnits": true, "mask": true, "maskUnits": true, "maskContentUnits": true,
	"offset": true, "stop-color": true, "stop-opacity": true,
	"gradientUnits": true, "gradientTransform": true, "spreadMethod": true,
	"patternUnits": true, "patternContentUnits": true, "patternTransform": true,
	"markerWidth": true, "markerHeight": true, "markerUnits": true, "refX": true, "refY": true, "orient": true,
	"marker-start": true, "marker-mid": true, "marker-end": true,
	"font-family": true, "font-size": true, "font-weight": true, "font-style": true,
	"text-anchor": true, "dominant-baseline": true, "letter-spacing": true, "word-spacing": true,
	"dx": true, "dy": true, "rotate": true, "textLength": true, "lengthAdjust": true,
	"vector-effect": true, "paint-order": true, "shape-rendering": true, "mix-blend-mode": true,
}

// What the root may not keep: a way to draw past its own box.
var rootOnlyInside = map[string]bool{"overflow": true, "transform": true}

// The only functions a value may call: colours, transforms, and a
// reference within the file (`url(#id)`, checked apart). Nothing else, so
// nothing can name an address in a form a check would have to foresee.
var allowedFunctions = map[string]bool{
	"url": true, "rgb": true, "rgba": true, "hsl": true, "hsla": true,
	"matrix": true, "translate": true, "scale": true, "rotate": true, "skewx": true, "skewy": true,
}

// A picture inside the drawing travels in it, as data, never by address.
var embeddedPicture = regexp.MustCompile(`^data:image/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\s]*$`)

var (
	functionCall    = regexp.MustCompile(`([A-Za-z_-]*)\s*\(`)
	wholeInternal   = regexp.MustCompile(`^#[A-Za-z0-9_.:-]+\)`)
	internalURL     = regexp.MustCompile(`(?i)url\(\s*['"]?\s*#([A-Za-z0-9_.:-]+)\s*['"]?\s*\)`)
	cssComment      = regexp.MustCompile(`(?s)/\*.*?\*/`)
	classSelector   = regexp.MustCompile(`^\.([A-Za-z_][A-Za-z0-9_-]*)$`)
	propertyName    = regexp.MustCompile(`^[A-Za-z-]+$`)
	classNameInList = regexp.MustCompile(`\S+`)
)

// ErrNotAnIcon is a file that is not an SVG drawing Bava can size.
var ErrNotAnIcon = errors.New("not an SVG icon")

// MaxDepth is how deep a drawing's elements may nest: far past any real
// icon, short of what strains a webview drawing it.
const MaxDepth = 256

// GrowthLimit is how many times its file's size a cleaned drawing may be:
// class rules copied onto elements make it larger, never without bound.
const GrowthLimit = 4

// Sanitise returns the SVG with everything that could run, fetch or reach
// outside the file taken out, sized by its viewBox so it draws at its own
// proportions. It refuses what is not one whole SVG, one with no size, and
// one whose class rules would make it far larger than the file.
func Sanitise(source []byte) (string, error) {
	limit := GrowthLimit*len(source) + 4096
	// What every stylesheet in the file may keep, together.
	styleBudget := limit
	decoder := xml.NewDecoder(bytes.NewReader(source))
	var out strings.Builder
	// Names of the elements open in the output, and how deep inside a dropped one we are.
	var open []string
	dropped := 0
	pending := false
	sawRoot, rootClosed := false, false
	// A stylesheet's text, gathered whole before any of it is read.
	var sheet *strings.Builder
	classes := map[string][]string{}
	closeStart := func() {
		if pending {
			out.WriteString(">")
			pending = false
		}
	}
	for {
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return "", fmt.Errorf("%w: %v", ErrNotAnIcon, err)
		}
		switch t := token.(type) {
		case xml.StartElement:
			if rootClosed {
				return "", fmt.Errorf("%w: more than one drawing in the file", ErrNotAnIcon)
			}
			if dropped > 0 {
				dropped++
				continue
			}
			name := t.Name.Local
			if !sawRoot {
				if name != "svg" || !svgSpace(t.Name.Space) {
					return "", fmt.Errorf("%w: the file is not an SVG", ErrNotAnIcon)
				}
				sawRoot = true
			}
			// A title or description holds words only: a page reads elements in them as its own.
			if len(open) > 0 && (open[len(open)-1] == "title" || open[len(open)-1] == "desc") {
				dropped = 1
				continue
			}
			if name == "style" && svgSpace(t.Name.Space) && sheet == nil {
				sheet = &strings.Builder{}
				dropped = 1
				continue
			}
			// A link keeps what it holds, as a group, and loses where it goes.
			if name == "a" && svgSpace(t.Name.Space) {
				name = "g"
			} else if !svgSpace(t.Name.Space) || !drawingElements[name] {
				dropped = 1
				continue
			}
			closeStart()
			attributes, err := keptAttributes(name, t.Attr, len(open) == 0, classes, limit)
			if err != nil {
				return "", err
			}
			if len(open) >= MaxDepth {
				return "", fmt.Errorf("%w: nested too deep", ErrNotAnIcon)
			}
			out.WriteString("<" + name + attributes)
			if out.Len() > limit {
				return "", fmt.Errorf("%w: its styles make it too large", ErrNotAnIcon)
			}
			pending = true
			open = append(open, name)
		case xml.EndElement:
			if dropped > 0 {
				dropped--
				if dropped == 0 && sheet != nil {
					if err := readClassRules(sheet.String(), classes, &styleBudget); err != nil {
						return "", err
					}
					sheet = nil
				}
				continue
			}
			if len(open) == 0 {
				continue
			}
			name := open[len(open)-1]
			open = open[:len(open)-1]
			if pending {
				out.WriteString("/>")
				pending = false
			} else {
				out.WriteString("</" + name + ">")
			}
			if len(open) == 0 {
				rootClosed = true
			}
		case xml.CharData:
			if sheet != nil && dropped == 1 {
				sheet.Write(t)
				continue
			}
			if dropped > 0 || len(open) == 0 {
				continue
			}
			closeStart()
			xml.EscapeText(&out, []byte(t))
		}
		// Comments, declarations and processing instructions are left out.
	}
	if !sawRoot || len(open) != 0 {
		return "", fmt.Errorf("%w: the drawing is not whole", ErrNotAnIcon)
	}
	return out.String(), nil
}

func svgSpace(space string) bool { return space == "" || space == svgNamespace }

// keptAttributes writes an element's safe attributes: the root sized by its
// viewBox first, and its class rules and own style as one style attribute.
func keptAttributes(element string, attributes []xml.Attr, root bool, classes map[string][]string, limit int) (string, error) {
	var b strings.Builder
	write := func(name, value string) {
		b.WriteString(" " + name + `="`)
		escapeAttribute(&b, value)
		b.WriteString(`"`)
	}
	if root {
		box, err := viewBoxOf(attributes)
		if err != nil {
			return "", err
		}
		write("xmlns", svgNamespace)
		write("viewBox", box)
		fields := strings.Fields(box)
		write("width", fields[2])
		write("height", fields[3])
	}
	var declarations []string
	styled := false
	for _, attribute := range attributes {
		if attribute.Name.Space != "" {
			continue
		}
		switch attribute.Name.Local {
		case "class":
			// A class named twice counts once.
			seen := map[string]bool{}
			size := 0
			for _, class := range classNameInList.FindAllString(attribute.Value, -1) {
				if seen[class] {
					continue
				}
				seen[class] = true
				for _, declaration := range classes[class] {
					// Counted as it is gathered: one element never holds more than the drawing may.
					if size += len(declaration) + 1; size > limit {
						return "", fmt.Errorf("%w: its styles make it too large", ErrNotAnIcon)
					}
				}
				declarations = append(declarations, classes[class]...)
			}
		case "style":
			declarations = append(declarations, cleanDeclarations(attribute.Value)...)
		}
	}
	if root {
		// The root keeps no style: there are too many ways for one to move or unclip the drawing.
		declarations = nil
	}
	written := map[string]bool{"xmlns": root, "viewBox": root, "width": root, "height": root}
	for _, attribute := range attributes {
		local := attribute.Name.Local
		if attribute.Name.Space == "" && (local == "class" || local == "style") {
			// Where the first of them stood.
			if !styled && len(declarations) > 0 {
				write("style", strings.Join(declarations, ";"))
			}
			styled = true
			continue
		}
		name, value, ok := keptAttribute(element, attribute)
		if !ok || written[name] || (root && rootOnlyInside[name]) {
			continue
		}
		written[name] = true
		write(name, value)
	}
	return b.String(), nil
}

// keptAttribute is the attribute as written out, or false when it goes.
func keptAttribute(element string, attribute xml.Attr) (string, string, bool) {
	name, space, value := attribute.Name.Local, attribute.Name.Space, attribute.Value
	switch {
	case space == "xmlns" || (space == "" && name == "xmlns"):
		return "", "", false
	case space == xlinkNamespace && name == "href":
		// The old spelling, written the way the page reads it.
	case space != "":
		return "", "", false
	}
	if name == "href" {
		// A picture is carried as data; anything else refers within the file.
		if element == "image" && embeddedPicture.MatchString(value) || element != "image" && strings.HasPrefix(value, "#") {
			return "href", value, true
		}
		return "", "", false
	}
	if !drawingAttributes[name] {
		return "", "", false
	}
	value, ok := cleanValue(value)
	return name, value, ok
}

// cleanValue is a value with its internal references written plainly, or
// false when it holds an escape or calls any function but the allowed ones,
// or a url() that is not within the file.
func cleanValue(value string) (string, bool) {
	if strings.ContainsAny(value, `\@`) {
		return "", false
	}
	value = internalURL.ReplaceAllString(value, "url(#$1)")
	for _, call := range functionCall.FindAllStringSubmatchIndex(value, -1) {
		name := strings.ToLower(value[call[2]:call[3]])
		if !allowedFunctions[name] {
			return "", false
		}
		if name == "url" && !wholeInternal.MatchString(value[call[1]:]) {
			return "", false
		}
	}
	return value, true
}

// cleanDeclarations is a style's declarations, each written plainly and
// each with a value cleanValue keeps; the rest go.
func cleanDeclarations(style string) []string {
	var kept []string
	for _, declaration := range strings.Split(style, ";") {
		property, value, ok := strings.Cut(declaration, ":")
		property, value = strings.TrimSpace(property), strings.TrimSpace(value)
		if !ok || !propertyName.MatchString(property) || value == "" {
			continue
		}
		if value, ok := cleanValue(value); ok {
			kept = append(kept, property+":"+value)
		}
	}
	return kept
}

// readClassRules reads a stylesheet's rules for plain class selectors
// (`.a`, `.a, .b`) into classes; every other rule, and every at-rule, goes.
// A selector repeated in a rule counts once, and what is kept is taken from
// budget, shared by every stylesheet in the file: past it, the file is refused.
func readClassRules(sheet string, classes map[string][]string, budget *int) error {
	sheet = cssComment.ReplaceAllString(sheet, " ")
	for i := 0; i < len(sheet); {
		rest := sheet[i:]
		open := strings.IndexAny(rest, "{;")
		if open < 0 {
			return nil
		}
		head := strings.TrimSpace(rest[:open])
		if rest[open] == ';' {
			// A statement at-rule, such as an import.
			i += open + 1
			continue
		}
		end := closingBrace(rest, open)
		if end < 0 {
			return nil
		}
		body := rest[open+1 : end]
		i += end + 1
		if strings.HasPrefix(head, "@") || strings.Contains(body, "{") {
			continue
		}
		declarations := cleanDeclarations(body)
		size := 0
		for _, declaration := range declarations {
			size += len(declaration) + 1
		}
		seen := map[string]bool{}
		for _, selector := range strings.Split(head, ",") {
			match := classSelector.FindStringSubmatch(strings.TrimSpace(selector))
			if match == nil || seen[match[1]] {
				continue
			}
			seen[match[1]] = true
			if *budget -= size; *budget < 0 {
				return fmt.Errorf("%w: its styles make it too large", ErrNotAnIcon)
			}
			classes[match[1]] = append(classes[match[1]], declarations...)
		}
	}
	return nil
}

// closingBrace is where the block opened at open ends, nested blocks included; -1 when it never does.
func closingBrace(text string, open int) int {
	depth := 0
	for i := open; i < len(text); i++ {
		switch text[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return i
			}
		}
	}
	return -1
}

// viewBoxOf is the drawing's box: its own, or one from a plain width and height.
func viewBoxOf(attributes []xml.Attr) (string, error) {
	var viewBox, width, height string
	for _, attribute := range attributes {
		if attribute.Name.Space != "" {
			continue
		}
		switch attribute.Name.Local {
		case "viewBox":
			viewBox = attribute.Value
		case "width":
			width = attribute.Value
		case "height":
			height = attribute.Value
		}
	}
	if fields := strings.Fields(strings.ReplaceAll(viewBox, ",", " ")); len(fields) == 4 {
		numbers := make([]float64, 4)
		for i, field := range fields {
			n, err := strconv.ParseFloat(field, 64)
			if err != nil {
				return "", fmt.Errorf("%w: its viewBox is not four numbers", ErrNotAnIcon)
			}
			numbers[i] = n
		}
		if numbers[2] > 0 && numbers[3] > 0 {
			return strings.Join(fields, " "), nil
		}
	}
	w, wok := plainLength(width)
	h, hok := plainLength(height)
	if !wok || !hok {
		return "", fmt.Errorf("%w: it has no size", ErrNotAnIcon)
	}
	return "0 0 " + w + " " + h, nil
}

// plainLength is a positive length in user units or pixels, as a number.
func plainLength(value string) (string, bool) {
	value = strings.TrimSuffix(strings.TrimSpace(value), "px")
	n, err := strconv.ParseFloat(value, 64)
	if err != nil || n <= 0 {
		return "", false
	}
	return strconv.FormatFloat(n, 'f', -1, 64), true
}

func escapeAttribute(b *strings.Builder, value string) {
	for _, r := range value {
		switch r {
		case '&':
			b.WriteString("&amp;")
		case '<':
			b.WriteString("&lt;")
		case '>':
			b.WriteString("&gt;")
		case '"':
			b.WriteString("&quot;")
		case '\n':
			b.WriteString("&#10;")
		case '\r':
			b.WriteString("&#13;")
		case '\t':
			b.WriteString("&#9;")
		default:
			b.WriteRune(r)
		}
	}
}
