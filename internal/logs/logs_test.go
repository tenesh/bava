package logs_test

import (
	"bytes"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/tenesh/bava/internal/logs"
)

func TestDirPerPlatform(t *testing.T) {
	cases := []struct {
		name string
		goos string
		env  logs.Env
		want string
	}{
		{"macOS", "darwin", logs.Env{Home: "/Users/a"}, "/Users/a/Library/Logs/Bava"},
		{"Windows", "windows", logs.Env{Home: `C:\Users\a`, LocalAppData: `C:\Users\a\AppData\Local`}, filepath.Join(`C:\Users\a\AppData\Local`, "Bava", "logs")},
		{"Linux with XDG", "linux", logs.Env{Home: "/home/a", XDGStateHome: "/state"}, "/state/bava/logs"},
		{"Linux default", "linux", logs.Env{Home: "/home/a"}, "/home/a/.local/state/bava/logs"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := logs.Dir(tc.goos, tc.env)
			if err != nil {
				t.Fatal(err)
			}
			if got != tc.want {
				t.Errorf("Dir = %q, want %q", got, tc.want)
			}
		})
	}

	// No LOCALAPPDATA is a broken Windows environment, not a reason to write
	// logs somewhere surprising.
	if _, err := logs.Dir("windows", logs.Env{Home: `C:\Users\a`}); err == nil {
		t.Error("windows without LOCALAPPDATA: want an error")
	}
}

func start(t *testing.T, dir string, at time.Time, opts ...func(*logs.Options)) *logs.Session {
	t.Helper()
	// A PID no process can have, so "is it still running?" is always no
	// unless a test says otherwise.
	o := logs.Options{Dir: dir, Now: at, PID: 1 << 30, Home: "/Users/someone"}
	for _, f := range opts {
		f(&o)
	}
	session, err := logs.Start(o)
	if err != nil {
		t.Fatal(err)
	}
	return session
}

func sessionFiles(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".log") && !strings.HasSuffix(e.Name(), ".1.log") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	return names
}

var base = time.Date(2026, 9, 17, 10, 0, 0, 0, time.UTC)

func TestPruneKeepsTheNewestTenAndTheCurrent(t *testing.T) {
	dir := t.TempDir()
	for i := 0; i < 14; i++ {
		s := start(t, dir, base.Add(time.Duration(i)*time.Minute))
		s.Close()
	}
	current := start(t, dir, base.Add(time.Hour))
	defer current.Close()

	names := sessionFiles(t, dir)
	if len(names) != 10 {
		t.Fatalf("kept %d sessions, want 10: %v", len(names), names)
	}
	if names[len(names)-1] != current.Name {
		t.Errorf("newest kept is %q, want the current session %q", names[len(names)-1], current.Name)
	}
}

func TestPruneRespectsTheSizeCap(t *testing.T) {
	dir := t.TempDir()
	for i := 0; i < 5; i++ {
		s := start(t, dir, base.Add(time.Duration(i)*time.Minute))
		s.Close()
		// Pad each finished session to 400 bytes.
		path := filepath.Join(dir, s.Name)
		if err := os.WriteFile(path, bytes.Repeat([]byte("x"), 400), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	current := start(t, dir, base.Add(time.Hour), func(o *logs.Options) { o.MaxBytes = 1000 })
	defer current.Close()

	names := sessionFiles(t, dir)
	var total int64
	for _, n := range names {
		info, _ := os.Stat(filepath.Join(dir, n))
		total += info.Size()
	}
	if total > 1000 {
		t.Errorf("folder holds %d bytes of sessions, want at most 1000: %v", total, names)
	}
	if names[len(names)-1] != current.Name {
		t.Errorf("current session was pruned")
	}
}

func TestSessionRollsPastTheCap(t *testing.T) {
	dir := t.TempDir()
	s := start(t, dir, base, func(o *logs.Options) { o.MaxBytes = 2000 })
	for i := 0; i < 200; i++ {
		s.Logger.Warn("filler line to push the session past its cap", "i", i)
	}
	s.Logger.Warn("the newest line")
	s.Close()

	content, err := os.ReadFile(filepath.Join(dir, s.Name))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "the newest line") {
		t.Error("the newest line was not kept")
	}
	if len(content) > 2000 {
		t.Errorf("session file is %d bytes, want at most the cap", len(content))
	}
	if _, err := os.Stat(filepath.Join(dir, strings.TrimSuffix(s.Name, ".log")+".1.log")); err != nil {
		t.Errorf("no rolled file: %v", err)
	}
}

func TestHomeDirectoryIsRedacted(t *testing.T) {
	dir := t.TempDir()
	s := start(t, dir, base)
	s.Logger.Warn("could not open /Users/someone/notes.md", "path", "/Users/someone/work/plan.md", "err", os.ErrNotExist)
	s.Close()

	content, _ := os.ReadFile(filepath.Join(dir, s.Name))
	if strings.Contains(string(content), "/Users/someone") {
		t.Errorf("home directory leaked into the log:\n%s", content)
	}
	if !strings.Contains(string(content), "~/notes.md") || !strings.Contains(string(content), "~/work/plan.md") {
		t.Errorf("paths were not rewritten to ~:\n%s", content)
	}
}

func TestVerboseSwitchesLevelAtRuntime(t *testing.T) {
	dir := t.TempDir()
	s := start(t, dir, base)
	s.Logger.Debug("hidden while quiet")
	s.SetVerbose(true)
	s.Logger.Debug("shown while verbose")
	s.SetVerbose(false)
	s.Logger.Debug("hidden again")
	s.Close()

	content, _ := os.ReadFile(filepath.Join(dir, s.Name))
	text := string(content)
	if strings.Contains(text, "hidden") || !strings.Contains(text, "shown while verbose") {
		t.Errorf("verbose did not switch the level:\n%s", text)
	}
}

func TestSessionStartIsRecordedAtTheDefaultLevel(t *testing.T) {
	dir := t.TempDir()
	s := start(t, dir, base)
	s.Close()
	content, _ := os.ReadFile(filepath.Join(dir, s.Name))
	if !strings.Contains(string(content), "session start") || !strings.Contains(string(content), "session end") {
		t.Errorf("session start and end are not recorded:\n%s", content)
	}
}

func TestTailReturnsTheLastLines(t *testing.T) {
	dir := t.TempDir()
	s := start(t, dir, base)
	defer s.Close()
	for i := 0; i < 5; i++ {
		s.Logger.Warn("line", "i", i)
	}
	lines, err := s.Tail(2)
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 2 || !strings.Contains(lines[1], "i=4") {
		t.Errorf("Tail(2) = %q", lines)
	}
}

// slog must stay the interface: Wails takes a *slog.Logger.
var _ *slog.Logger = (&logs.Session{}).Logger

func TestFirstLaunchIsClean(t *testing.T) {
	s := start(t, t.TempDir(), base)
	defer s.Close()
	if s.Previous.Unexpected {
		t.Error("a first launch reported an unexpected end")
	}
}

func TestCleanCloseReportsCleanNextTime(t *testing.T) {
	dir := t.TempDir()
	start(t, dir, base).Close()
	next := start(t, dir, base.Add(time.Minute))
	defer next.Close()
	if next.Previous.Unexpected {
		t.Error("a clean close was reported as unexpected")
	}
}

// A session that never closed — a crash, a force quit, a power cut — leaves
// its marker behind, and the next launch names it.
func TestMissingCloseReportsUnexpectedWithTheSessionName(t *testing.T) {
	dir := t.TempDir()
	crashed := start(t, dir, base)
	// No Close: the process "died" here.

	next := start(t, dir, base.Add(time.Minute))
	defer next.Close()
	if !next.Previous.Unexpected {
		t.Fatal("an unclosed session was not reported")
	}
	if next.Previous.Session != crashed.Name {
		t.Errorf("Previous.Session = %q, want %q", next.Previous.Session, crashed.Name)
	}
}

// Wails logs every bound call's arguments and result at debug level — whole
// documents. Its logger keeps only messages and attribute names, and never
// goes below warn, whatever the verbose setting.
func TestWailsLoggerNeverRecordsValuesOrDebug(t *testing.T) {
	dir := t.TempDir()
	s := start(t, dir, base, func(o *logs.Options) { o.Verbose = true })
	wails := s.WailsLogger()

	wails.Debug("Binding call complete:", "method", "FileService.Save", "args", `["# SECRET-PROSE"]`)
	wails.Error("OpenURL: invalid URL", "err", "https://SECRET-HOST/")
	wails.Warn("Window ID not found:", "id", 7)
	s.Close()

	content, _ := os.ReadFile(filepath.Join(dir, s.Name))
	text := string(content)
	if strings.Contains(text, "SECRET") || strings.Contains(text, "Binding call complete") {
		t.Errorf("the Wails logger leaked a value or a debug line:\n%s", text)
	}
	if !strings.Contains(text, "Window ID not found") || !strings.Contains(text, "id=[redacted]") {
		t.Errorf("warnings should keep their message and attribute names:\n%s", text)
	}
}

// Two windows of Bava at once must not report each other as crashed, nor
// prune each other's live logs.
func TestAnotherRunningSessionIsNeitherACrashNorPruned(t *testing.T) {
	dir := t.TempDir()
	first := start(t, dir, base, func(o *logs.Options) { o.KeepSessions = 1; o.PID = os.Getpid() })
	defer first.Close()

	second := start(t, dir, base.Add(time.Minute), func(o *logs.Options) { o.KeepSessions = 1; o.PID = os.Getpid() + 1 })
	defer second.Close()

	if second.Previous.Unexpected {
		t.Error("a session still running was reported as an unexpected exit")
	}
	if _, err := os.Stat(first.Path()); err != nil {
		t.Errorf("the running session's log was pruned: %v", err)
	}
}

func TestADeadSessionsMarkerIsReportedOnce(t *testing.T) {
	dir := t.TempDir()
	// A PID that cannot be running.
	crashed := start(t, dir, base, func(o *logs.Options) { o.PID = 1 << 30 })
	next := start(t, dir, base.Add(time.Minute))
	if !next.Previous.Unexpected || next.Previous.Session != crashed.Name {
		t.Fatalf("Previous = %+v, want the crashed session", next.Previous)
	}
	next.Close()
	again := start(t, dir, base.Add(2*time.Minute))
	defer again.Close()
	if again.Previous.Unexpected {
		t.Error("the same crash was reported twice")
	}
}

func TestLogFilesAreOnlyReadableByTheUser(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "logs")
	s := start(t, dir, base)
	defer s.Close()
	for path, want := range map[string]os.FileMode{dir: 0o700, s.Path(): 0o600} {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if got := info.Mode().Perm(); got != want {
			t.Errorf("%s has mode %v, want %v", path, got, want)
		}
	}
}

func TestPruneRemovesOrphanRolls(t *testing.T) {
	dir := t.TempDir()
	orphan := filepath.Join(dir, "2020-01-01T00-00-00-1.1.log")
	if err := os.WriteFile(orphan, []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	s := start(t, dir, base)
	defer s.Close()
	if _, err := os.Stat(orphan); !os.IsNotExist(err) {
		t.Error("a roll with no session file was kept")
	}
}

func TestDiscardSessionWorksWithoutAFolder(t *testing.T) {
	s := logs.Discard()
	s.Logger.Error("goes nowhere")
	if _, err := s.Tail(10); err != nil {
		t.Errorf("Tail on a discard session: %v", err)
	}
	if err := s.Close(); err != nil {
		t.Errorf("Close on a discard session: %v", err)
	}
}
