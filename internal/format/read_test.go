package format_test

import (
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/format"
)

const sample = "# Ingest\n\nProse here.\n\n```d2 id=write-path\nwriter -> queue\n```\n\nMore prose.\n\n```bava-canvas\n{\n  \"version\": 1,\n  \"elements\": [\n    {\"id\": \"e1\", \"type\": \"rect\", \"x\": 1, \"y\": 2, \"w\": 3, \"h\": 4, \"z\": 1}\n  ]\n}\n```\n"

func TestReadsProseDiagramBlocksAndScene(t *testing.T) {
	file, err := format.Read(sample)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if !strings.Contains(file.Source, "# Ingest") {
		t.Error("prose is missing from Source")
	}
	if len(file.Diagrams) != 1 || file.Diagrams["write-path"] != "writer -> queue\n" {
		t.Errorf("diagrams = %+v", file.Diagrams)
	}
	if len(file.Scene.Elements) != 1 {
		t.Fatalf("scene has %d elements, want 1", len(file.Scene.Elements))
	}
	if file.Scene.Elements[0].Type != "rect" {
		t.Errorf("element type = %q", file.Scene.Elements[0].Type)
	}
}

func TestFileWithNoCanvasBlockReadsAsEmptyScene(t *testing.T) {
	file, err := format.Read("# Just prose\n\nNothing else.\n")
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if len(file.Scene.Elements) != 0 {
		t.Errorf("expected an empty scene, got %d elements", len(file.Scene.Elements))
	}
	if file.HasCanvas {
		t.Error("HasCanvas is true for a file with no canvas block")
	}
}

// A newer Bava will write element types this one does not know. Dropping them
// destroys the user's work silently, which is unrecoverable once shipped.
func TestUnknownElementTypeIsRetained(t *testing.T) {
	src := "p\n\n```bava-canvas\n{\"version\":1,\"elements\":[{\"id\":\"x1\",\"type\":\"hologram\",\"x\":0,\"y\":0,\"w\":1,\"h\":1,\"z\":1,\"spin\":42}]}\n```\n"

	file, err := format.Read(src)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if len(file.Scene.Elements) != 1 {
		t.Fatalf("element count = %d", len(file.Scene.Elements))
	}
	if file.Scene.Elements[0].Type != "hologram" {
		t.Errorf("type = %q", file.Scene.Elements[0].Type)
	}
	if !strings.Contains(string(file.Scene.Elements[0].Raw), "spin") {
		t.Error("the unknown element's own fields were not retained")
	}
}

func TestUnknownKeysOnAKnownElementAreRetained(t *testing.T) {
	src := "p\n\n```bava-canvas\n{\"version\":1,\"elements\":[{\"id\":\"e1\",\"type\":\"rect\",\"x\":0,\"y\":0,\"w\":1,\"h\":1,\"z\":1,\"glow\":true}]}\n```\n"

	file, err := format.Read(src)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if !strings.Contains(string(file.Scene.Elements[0].Raw), "glow") {
		t.Error("unknown key was dropped")
	}
}

// Losing a whole document to one bad trailing block is the worst outcome
// available, so the prose comes back even when the scene does not.
func TestMalformedCanvasBlockIsAnErrorButProseSurvives(t *testing.T) {
	src := "# Keep me\n\n```bava-canvas\n{not json\n```\n"

	file, err := format.Read(src)
	if err == nil {
		t.Fatal("expected an error for a malformed canvas block")
	}
	if !strings.Contains(file.Source, "# Keep me") {
		t.Error("prose was lost along with the bad block")
	}
}

func TestSeveralDiagramBlocks(t *testing.T) {
	src := "a\n\n```d2 id=one\nx\n```\n\nb\n\n```d2 id=two\ny\n```\n"
	file, err := format.Read(src)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if len(file.Diagrams) != 2 {
		t.Errorf("diagrams = %+v", file.Diagrams)
	}
}

func TestDiagramBlockWithoutAnIdIsIgnoredForReferences(t *testing.T) {
	// Still prose, still written back — just not referenceable from the canvas.
	file, err := format.Read("a\n\n```d2\nx -> y\n```\n")
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if len(file.Diagrams) != 0 {
		t.Errorf("diagrams = %+v, want none", file.Diagrams)
	}
}
