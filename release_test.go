package main_test

import (
	"os/exec"
	"strings"
	"testing"
)

// deps lists the packages a build of Bava links, with the given build tags.
func deps(t *testing.T, tags ...string) string {
	t.Helper()
	args := []string{"list", "-deps"}
	if len(tags) > 0 {
		args = append(args, "-tags", strings.Join(tags, ","))
	}
	out, err := exec.Command("go", append(args, ".")...).Output()
	if err != nil {
		t.Fatal(err)
	}
	return string(out)
}

// The smoke test driver never ships: a build without the e2e tag must not
// link it at all.
func TestAReleaseBuildHasNoSmokeDriver(t *testing.T) {
	if strings.Contains(deps(t), "github.com/tenesh/bava/internal/e2e") {
		t.Error("a build without -tags e2e links internal/e2e")
	}
	if !strings.Contains(deps(t, "e2e"), "github.com/tenesh/bava/internal/e2e") {
		t.Error("a build with -tags e2e does not link internal/e2e, so this test proves nothing")
	}
}

// The tests' shared helpers are for tests only: no build links them.
func TestNoBuildLinksTheTestHelpers(t *testing.T) {
	out, err := exec.Command("go", "list", "-deps", "-test", "./internal/render").Output()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(out), "github.com/tenesh/bava/internal/testutil") {
		t.Fatal("render's tests do not link internal/testutil, so this test proves nothing")
	}
	for _, tags := range [][]string{nil, {"e2e"}} {
		if strings.Contains(deps(t, tags...), "github.com/tenesh/bava/internal/testutil") {
			t.Errorf("a build with tags %v links internal/testutil", tags)
		}
	}
}
