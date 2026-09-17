package format_test

import (
	"testing"

	"github.com/tenesh/bava/internal/format"
)

func TestFindsFencedBlocksWithInfoStrings(t *testing.T) {
	src := "intro\n\n```d2 id=write-path\na -> b\n```\n\nmore\n\n```bava-canvas\n{}\n```\n"

	blocks := format.Scan(src)

	if len(blocks) != 2 {
		t.Fatalf("found %d blocks, want 2: %+v", len(blocks), blocks)
	}
	if blocks[0].Info != "d2 id=write-path" {
		t.Errorf("first info = %q", blocks[0].Info)
	}
	if blocks[0].Body != "a -> b\n" {
		t.Errorf("first body = %q", blocks[0].Body)
	}
	if blocks[1].Info != "bava-canvas" {
		t.Errorf("second info = %q", blocks[1].Info)
	}
}

// A longer fence is one block even when it contains shorter fences. Treating
// the inner ones as delimiters would split a code sample down the middle.
func TestIgnoresFencesInsideALongerFence(t *testing.T) {
	src := "````md\nhere is how to write one:\n```d2\na -> b\n```\n````\n"

	blocks := format.Scan(src)

	if len(blocks) != 1 {
		t.Fatalf("found %d blocks, want 1", len(blocks))
	}
	if blocks[0].Info != "md" {
		t.Errorf("info = %q, want %q", blocks[0].Info, "md")
	}
}

func TestUnterminatedFenceIsNotABlock(t *testing.T) {
	src := "intro\n\n```d2\na -> b\n"

	blocks := format.Scan(src)

	if len(blocks) != 0 {
		t.Errorf("found %d blocks, want 0; an unterminated fence is prose", len(blocks))
	}
}

// Offsets are what the writer splices with. If they are off by a byte it
// corrupts the file rather than failing.
func TestOffsetsSliceTheOriginalExactly(t *testing.T) {
	src := "before\n\n```bava-canvas\n{\"version\":1}\n```\n\nafter\n"

	blocks := format.Scan(src)

	if len(blocks) != 1 {
		t.Fatalf("found %d blocks, want 1", len(blocks))
	}
	got := src[blocks[0].Start:blocks[0].End]
	want := "```bava-canvas\n{\"version\":1}\n```\n"
	if got != want {
		t.Errorf("slice = %q, want %q", got, want)
	}
}

func TestHandlesCRLF(t *testing.T) {
	src := "intro\r\n\r\n```d2\r\na -> b\r\n```\r\n"

	blocks := format.Scan(src)

	if len(blocks) != 1 {
		t.Fatalf("found %d blocks, want 1", len(blocks))
	}
	if blocks[0].Info != "d2" {
		t.Errorf("info = %q", blocks[0].Info)
	}
}

func TestNoBlocksInPlainProse(t *testing.T) {
	if blocks := format.Scan("just words\n\nand more words\n"); len(blocks) != 0 {
		t.Errorf("found %d blocks in prose", len(blocks))
	}
}

func TestIndentedFenceInsideAListIsABlock(t *testing.T) {
	src := "- item\n\n  ```d2\n  a -> b\n  ```\n"

	blocks := format.Scan(src)

	if len(blocks) != 1 {
		t.Fatalf("found %d blocks, want 1", len(blocks))
	}
}
