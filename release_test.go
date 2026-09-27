package main

import (
	"os/exec"
	"strings"
	"testing"
)

// The smoke test driver never ships: a build without the e2e tag must not
// link it at all.
func TestAReleaseBuildHasNoSmokeDriver(t *testing.T) {
	out, err := exec.Command("go", "list", "-deps", ".").Output()
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(out), "github.com/tenesh/bava/internal/e2e") {
		t.Error("a build without -tags e2e links internal/e2e")
	}
	tagged, err := exec.Command("go", "list", "-deps", "-tags", "e2e", ".").Output()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(tagged), "github.com/tenesh/bava/internal/e2e") {
		t.Error("a build with -tags e2e does not link internal/e2e, so this test proves nothing")
	}
}
