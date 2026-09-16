package format_test

import (
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/format"
)

func TestOmitsTheCanvasBlockWhenTheSceneIsEmpty(t *testing.T) {
	file, err := format.Read("# Just prose\n\nNothing else.\n")
	if err != nil {
		t.Fatalf("Read: %v", err)
	}

	out, err := format.Write(file)
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	if strings.Contains(out, format.CanvasInfo) {
		t.Error("a canvas block was added to a document with no canvas")
	}
	if out != file.Source {
		t.Errorf("a document with no canvas was modified:\n got %q\nwant %q", out, file.Source)
	}
}

func TestCanvasBlockIsLastInTheFile(t *testing.T) {
	file, _ := format.Read("# Title\n\nProse.\n")
	file.Scene.Elements = []format.Element{{ID: "e1", Type: "rect", W: 10, H: 10, Z: 1}}

	out, err := format.Write(file)
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	blocks := format.Scan(out)
	if len(blocks) == 0 {
		t.Fatal("no blocks in output")
	}
	last := blocks[len(blocks)-1]
	if last.Info != format.CanvasInfo {
		t.Errorf("last block is %q, want the canvas", last.Info)
	}
	if strings.TrimSpace(out[last.End:]) != "" {
		t.Errorf("content after the canvas block: %q", out[last.End:])
	}
}

func TestCanvasBlockIsPrettyPrinted(t *testing.T) {
	file, _ := format.Read("p\n")
	file.Scene.Elements = []format.Element{{ID: "e1", Type: "rect", W: 1, H: 1, Z: 1}}

	out, _ := format.Write(file)

	block := format.Scan(out)[0]
	if !strings.Contains(block.Body, "\n  ") {
		t.Errorf("canvas block is not indented — one long line makes every diff useless:\n%s", block.Body)
	}
}

// The property that stops us mangling files we did not author.
func TestProseIsByteIdenticalAfterWriting(t *testing.T) {
	prose := "# Title\n\nSome *emphasis*, a [link][ref], and   odd   spacing.\n\n> quote\n\n[ref]: http://example.com\n"
	file, err := format.Read(prose)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	file.Scene.Elements = []format.Element{{ID: "e1", Type: "rect", W: 1, H: 1, Z: 1}}

	out, err := format.Write(file)
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	if !strings.HasPrefix(out, prose) {
		t.Errorf("prose was altered:\n got %q\nwant prefix %q", out, prose)
	}
}

func TestReplacesAnExistingCanvasBlockInPlace(t *testing.T) {
	src := "before\n\n```bava-canvas\n{\"version\":1,\"elements\":[]}\n```\n"
	file, err := format.Read(src)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	file.Scene.Elements = []format.Element{{ID: "e9", Type: "ellipse", W: 2, H: 2, Z: 1}}

	out, _ := format.Write(file)

	if strings.Count(out, format.CanvasInfo) != 1 {
		t.Errorf("expected exactly one canvas block:\n%s", out)
	}
	if !strings.Contains(out, "e9") {
		t.Error("the new scene was not written")
	}
	if !strings.HasPrefix(out, "before\n") {
		t.Error("prose before the block was disturbed")
	}
}

// An element read from a newer file must go back with its own fields intact.
func TestUnknownElementIsWrittenBackVerbatim(t *testing.T) {
	src := "p\n\n```bava-canvas\n{\"version\":1,\"elements\":[{\"id\":\"x1\",\"type\":\"hologram\",\"x\":0,\"y\":0,\"w\":1,\"h\":1,\"z\":1,\"spin\":42}]}\n```\n"
	file, err := format.Read(src)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}

	out, err := format.Write(file)
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	if !strings.Contains(out, "\"spin\"") {
		t.Errorf("an unknown element lost its fields:\n%s", out)
	}
	if !strings.Contains(out, "hologram") {
		t.Error("an unknown element type was dropped")
	}
}

func TestUnknownTopLevelKeysAreWrittenBack(t *testing.T) {
	src := "p\n\n```bava-canvas\n{\"version\":1,\"elements\":[],\"grid\":{\"size\":8}}\n```\n"
	file, _ := format.Read(src)
	out, _ := format.Write(file)
	if !strings.Contains(out, "\"grid\"") {
		t.Errorf("an unknown top-level key was dropped:\n%s", out)
	}
}
