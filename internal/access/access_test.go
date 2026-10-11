package access_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/tharabyte/bava/internal/access"
)

// fakeKeeper stands in for a sandbox: a token is "kept:" and the path, and
// restoring one can be made to fail or come back stale.
type fakeKeeper struct {
	fail  map[string]bool
	stale map[string]bool
	moved map[string]string
	kept  []string
}

func (k *fakeKeeper) Sandboxed() bool { return true }

func (k *fakeKeeper) Keep(path string) ([]byte, error) {
	k.kept = append(k.kept, path)
	return []byte("kept:" + path), nil
}

func (k *fakeKeeper) Restore(token []byte) (string, bool, error) {
	path := string(token)[len("kept:"):]
	if k.fail[path] {
		return "", false, errors.New("the system refused it")
	}
	if to, ok := k.moved[path]; ok {
		return to, true, nil
	}
	return path, k.stale[path], nil
}

func setup(t *testing.T) (string, string) {
	t.Helper()
	state := filepath.Join(t.TempDir(), "access.json")
	space := t.TempDir()
	return state, space
}

func TestAFolderAllowedIsReachableAfterARelaunch(t *testing.T) {
	state, space := setup(t)
	keeper := &fakeKeeper{}
	s, err := access.Open(state, keeper)
	if err != nil {
		t.Fatal(err)
	}
	if s.Reachable(space) {
		t.Fatal("a folder never allowed is reachable in a sandbox")
	}
	if err := s.Allow(space); err != nil {
		t.Fatal(err)
	}
	again, err := access.Open(state, &fakeKeeper{})
	if err != nil {
		t.Fatal(err)
	}
	if !again.Reachable(space) || !again.Reachable(filepath.Join(space, "Marketing", "Plan.md")) {
		t.Error("an allowed folder or what is inside it is not reachable after a relaunch")
	}
}

func TestAGrantTheSystemRefusesIsReportedAndKept(t *testing.T) {
	state, space := setup(t)
	s, _ := access.Open(state, &fakeKeeper{})
	if err := s.Allow(space); err != nil {
		t.Fatal(err)
	}
	again, err := access.Open(state, &fakeKeeper{fail: map[string]bool{space: true}})
	if err != nil {
		t.Fatal(err)
	}
	if again.Reachable(space) {
		t.Error("a refused grant reads as reachable")
	}
	if lost := again.Lost(); len(lost) != 1 || lost[0] != space {
		t.Errorf("lost = %v; want the refused folder", lost)
	}
	// Still there, to be found again rather than silently forgotten.
	third, _ := access.Open(state, &fakeKeeper{})
	if !third.Reachable(space) {
		t.Error("a refused grant was dropped from the file")
	}
}

func TestAStaleGrantIsKeptAfresh(t *testing.T) {
	state, space := setup(t)
	s, _ := access.Open(state, &fakeKeeper{})
	_ = s.Allow(space)
	keeper := &fakeKeeper{stale: map[string]bool{space: true}}
	again, _ := access.Open(state, keeper)
	if !again.Reachable(space) {
		t.Error("a stale grant is not reachable")
	}
	if len(keeper.kept) != 1 || keeper.kept[0] != space {
		t.Errorf("kept afresh: %v; want the stale folder", keeper.kept)
	}
}

func TestAGrantForAFolderThatIsGoneIsLost(t *testing.T) {
	state, space := setup(t)
	s, _ := access.Open(state, &fakeKeeper{})
	_ = s.Allow(space)
	if err := os.RemoveAll(space); err != nil {
		t.Fatal(err)
	}
	again, _ := access.Open(state, &fakeKeeper{})
	if again.Reachable(space) || len(again.Lost()) != 1 {
		t.Error("a folder that is gone reads as reachable")
	}
}

func TestForgettingRemovesTheGrant(t *testing.T) {
	state, space := setup(t)
	s, _ := access.Open(state, &fakeKeeper{})
	_ = s.Allow(space)
	if err := s.Forget(space); err != nil {
		t.Fatal(err)
	}
	again, _ := access.Open(state, &fakeKeeper{})
	if again.Reachable(space) || len(again.Lost()) != 0 {
		t.Error("a forgotten grant came back")
	}
}

// Where nothing is sandboxed, anything that exists is reachable and nothing
// is written.
func TestWithoutASandboxWhatExistsIsReachable(t *testing.T) {
	state, space := setup(t)
	s, err := access.Open(state, access.None{})
	if err != nil {
		t.Fatal(err)
	}
	if !s.Reachable(space) || s.Reachable(filepath.Join(space, "missing")) {
		t.Error("without a sandbox, reachable is not simply whether it exists")
	}
	if err := s.Allow(space); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(state); !errors.Is(err, os.ErrNotExist) {
		t.Error("a grant was written where nothing is sandboxed")
	}
}

func TestAnUnreadableGrantsFileStartsEmpty(t *testing.T) {
	state, space := setup(t)
	if err := os.WriteFile(state, []byte("{not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	s, err := access.Open(state, &fakeKeeper{})
	if err == nil {
		t.Error("an unreadable file was not reported")
	}
	if s == nil || s.Reachable(space) {
		t.Fatal("no usable, empty store after an unreadable file")
	}
	if err := s.Allow(space); err != nil {
		t.Fatal(err)
	}
}

// What the user chose is granted for the launch everywhere, and kept only
// inside a sandbox; a folder grants what is inside it.
func TestWhatTheUserChoseIsGranted(t *testing.T) {
	for name, keeper := range map[string]access.Keeper{"sandbox": &fakeKeeper{}, "none": access.None{}} {
		state, space := setup(t)
		s, _ := access.Open(state, keeper)
		file := filepath.Join(space, "Contracts", "deal.pdf")
		if s.Granted(file) {
			t.Errorf("%s: granted before it was chosen", name)
		}
		if err := s.Allow(filepath.Dir(file)); err != nil {
			t.Fatal(err)
		}
		if !s.Granted(file) || s.Granted(filepath.Join(space, "other.pdf")) {
			t.Errorf("%s: a chosen folder does not grant exactly what is inside it", name)
		}
	}
}

// A bookmark follows a folder the user moved: Bava reaches it where it is
// now, and no longer where it was.
func TestAFolderMovedSinceItWasAllowedIsReachableWhereItIsNow(t *testing.T) {
	state, space := setup(t)
	s, _ := access.Open(state, &fakeKeeper{})
	if err := s.Allow(space); err != nil {
		t.Fatal(err)
	}
	moved := filepath.Join(t.TempDir(), "Renamed")
	if err := os.Rename(space, moved); err != nil {
		t.Fatal(err)
	}
	again, err := access.Open(state, &fakeKeeper{moved: map[string]string{space: moved}})
	if err != nil {
		t.Fatal(err)
	}
	if again.Reachable(space) {
		t.Error("the folder's old place reads as reachable")
	}
	if !again.Reachable(moved) || !again.Granted(moved) {
		t.Error("the folder is not reachable where it is now")
	}
	relaunched, _ := access.Open(state, &fakeKeeper{})
	if !relaunched.Reachable(moved) {
		t.Error("the new place was not kept for the next launch")
	}
}
