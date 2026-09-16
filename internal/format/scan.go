// Package format reads and writes Bava files.
//
// A Bava file is Markdown: prose, fenced `d2` blocks, and one trailing
// `bava-canvas` block. See docs/file-format.md, which is the specification
// this package implements and which is written before any change here.
package format

import "strings"

// Block is a fenced code block found in a Markdown document.
type Block struct {
	// Info is the fence's info string — "d2 id=write-path", "bava-canvas".
	Info string
	// Body is the block's content, without the fences.
	Body string
	// Start and End slice the original source, fences included, so a writer
	// can splice a replacement in without touching anything else.
	Start int
	End   int
}

// Scan finds fenced code blocks.
//
// Deliberately not a Markdown parser. We need exactly two things — fenced
// blocks with their info strings, and every other byte left alone. A real
// parser round-trips prose *approximately*: it normalises whitespace, rewrites
// emphasis markers, reorders reference links. Approximate is a synonym for
// corrupting a file somebody else wrote.
func Scan(source string) []Block {
	var blocks []Block

	lines, offsets := splitLines(source)

	for i := 0; i < len(lines); i++ {
		indent, fence, info, ok := openingFence(lines[i])
		if !ok {
			continue
		}

		// The closing fence must be at least as long as the opening one, which
		// is what lets a longer fence contain shorter ones verbatim.
		closeAt := -1
		for j := i + 1; j < len(lines); j++ {
			if isClosingFence(lines[j], fence) {
				closeAt = j
				break
			}
		}

		// An unterminated fence is prose, not a block. Treating it as one would
		// swallow the rest of the file.
		if closeAt == -1 {
			continue
		}

		body := strings.Join(stripIndent(lines[i+1:closeAt], indent), "")
		end := offsets[closeAt] + len(lines[closeAt])

		blocks = append(blocks, Block{
			Info:  strings.TrimSpace(info),
			Body:  body,
			Start: offsets[i],
			End:   end,
		})

		i = closeAt
	}

	return blocks
}

// splitLines keeps line endings on the lines, so offsets stay exact for CRLF
// input as well as LF.
func splitLines(source string) (lines []string, offsets []int) {
	start := 0
	for i := 0; i < len(source); i++ {
		if source[i] != '\n' {
			continue
		}
		lines = append(lines, source[start:i+1])
		offsets = append(offsets, start)
		start = i + 1
	}
	if start < len(source) {
		lines = append(lines, source[start:])
		offsets = append(offsets, start)
	}
	return lines, offsets
}

func openingFence(line string) (indent, fence, info string, ok bool) {
	trimmed := strings.TrimLeft(line, " \t")
	indent = line[:len(line)-len(trimmed)]

	// Up to three spaces of indent is still a fence in Markdown, and a fence
	// inside a list item is indented further; both are blocks to us.
	count := 0
	for count < len(trimmed) && trimmed[count] == '`' {
		count++
	}
	if count < 3 {
		return "", "", "", false
	}

	rest := strings.TrimRight(trimmed[count:], "\r\n")
	// A fence's info string cannot itself contain a backtick.
	if strings.Contains(rest, "`") {
		return "", "", "", false
	}

	return indent, strings.Repeat("`", count), rest, true
}

func isClosingFence(line, fence string) bool {
	trimmed := strings.TrimSpace(line)
	if !strings.HasPrefix(trimmed, fence) {
		return false
	}
	return strings.Trim(trimmed, "`") == ""
}

// stripIndent removes the opening fence's indentation from body lines, so a
// block inside a list item yields the same body as one at the margin.
func stripIndent(lines []string, indent string) []string {
	if indent == "" {
		return lines
	}
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		out = append(out, strings.TrimPrefix(line, indent))
	}
	return out
}
