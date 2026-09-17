package app_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/tenesh/bava/internal/app"
	"github.com/tenesh/bava/internal/logs"
)

type clock struct{ t time.Time }

func (c *clock) now() time.Time { return c.t }

func logService(t *testing.T, opts ...func(*app.LogServiceOptions)) (*app.LogService, *logs.Session, *clock) {
	t.Helper()
	session, err := logs.Start(logs.Options{Dir: t.TempDir(), Home: "/Users/someone"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { session.Close() })
	c := &clock{t: time.Date(2026, 9, 17, 10, 0, 0, 0, time.UTC)}
	o := app.LogServiceOptions{
		Session:     session,
		Now:         c.now,
		OSVersion:   func() string { return "15.6" },
		OpenFolder:  func(string) error { return nil },
		SaveVerbose: func(bool) error { return nil },
	}
	for _, f := range opts {
		f(&o)
	}
	return app.NewLogService(o), session, c
}

func logText(t *testing.T, s *logs.Session) string {
	t.Helper()
	content, err := os.ReadFile(s.Path())
	if err != nil {
		t.Fatal(err)
	}
	return string(content)
}

// A frontend stuck in a render loop must not fill the disk.
func TestReportIsRateLimited(t *testing.T) {
	service, session, c := logService(t)
	for i := 0; i < 50; i++ {
		service.Report(app.LogEntry{Level: "error", Kind: "BoomError", Source: "window"})
	}
	if got := strings.Count(logText(t, session), "BoomError"); got != 20 {
		t.Errorf("logged %d of 50 reports inside one window, want 20", got)
	}

	c.t = c.t.Add(11 * time.Second)
	service.Report(app.LogEntry{Level: "error", Kind: "AfterError", Source: "window"})
	text := logText(t, session)
	if !strings.Contains(text, "suppressed=30") {
		t.Errorf("the suppressed count was not recorded:\n%s", text)
	}
	if !strings.Contains(text, "AfterError") {
		t.Error("a report in the next window was dropped")
	}
}

func TestReportTruncatesLongFields(t *testing.T) {
	service, session, _ := logService(t)
	service.Report(app.LogEntry{Level: "error", Kind: strings.Repeat("k", 5000), Stack: strings.Repeat("é", 10000)})
	text := logText(t, session)
	if strings.Contains(text, strings.Repeat("k", 201)) || strings.Contains(text, strings.Repeat("é", 4001)) {
		t.Error("a field was logged past its cap")
	}
	if !utf8.ValidString(text) {
		t.Error("truncation split a multi-byte character")
	}
}

func TestDiagnosticsNamesTheBuildAndRedacts(t *testing.T) {
	service, session, _ := logService(t)
	session.Logger.Warn("opened /Users/someone/secret-plans.md")

	report := service.Diagnostics("Mozilla/5.0 AppleWebKit/605.1.15")
	for _, want := range []string{"Bava", "unstamped development build", "OS:", "15.6", "AppleWebKit/605.1.15", "~/secret-plans.md"} {
		if !strings.Contains(report, want) {
			t.Errorf("diagnostics missing %q:\n%s", want, report)
		}
	}
	if strings.Contains(report, "/Users/someone") {
		t.Errorf("diagnostics leaked the home directory:\n%s", report)
	}
}

func TestNoticesAreTakenOnce(t *testing.T) {
	dir := t.TempDir()
	// Never closed, and its process is gone: a crash.
	if _, err := logs.Start(logs.Options{Dir: dir, PID: 1 << 30}); err != nil {
		t.Fatal(err)
	}
	session, err := logs.Start(logs.Options{Dir: dir})
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()

	service := app.NewLogService(app.LogServiceOptions{Session: session})
	notices := service.TakeNotices()
	if len(notices) != 1 || notices[0].Kind != app.NoticeUnexpectedExit {
		t.Fatalf("first take = %+v, want one unexpected-exit notice", notices)
	}
	if again := service.TakeNotices(); len(again) != 0 {
		t.Errorf("second take = %+v, want none", again)
	}
}

func TestSetVerboseChangesTheLevelAndSaves(t *testing.T) {
	var saved []bool
	service, session, _ := logService(t, func(o *app.LogServiceOptions) {
		o.SaveVerbose = func(on bool) error { saved = append(saved, on); return nil }
	})
	if msg := service.SetVerbose(true); msg != "" {
		t.Fatal(msg)
	}
	session.Logger.Debug("debug detail")
	if !strings.Contains(logText(t, session), "debug detail") || len(saved) != 1 || !saved[0] {
		t.Error("SetVerbose(true) did not switch the level and save it")
	}
}

func TestOpenLogsFolderOpensTheSessionFolder(t *testing.T) {
	var opened string
	service, session, _ := logService(t, func(o *app.LogServiceOptions) {
		o.OpenFolder = func(path string) error { opened = path; return nil }
	})
	if msg := service.OpenLogsFolder(); msg != "" {
		t.Fatal(msg)
	}
	if filepath.Clean(opened) != filepath.Clean(session.Dir) {
		t.Errorf("opened %q, want %q", opened, session.Dir)
	}
}

func TestVerboseStaysOffWhenTheSaveFails(t *testing.T) {
	service, session, _ := logService(t, func(o *app.LogServiceOptions) {
		o.SaveVerbose = func(bool) error { return os.ErrPermission }
	})
	if msg := service.SetVerbose(true); msg == "" {
		t.Fatal("a failed save reported success")
	}
	session.Logger.Debug("debug detail")
	if strings.Contains(logText(t, session), "debug detail") {
		t.Error("the level changed although the preference was not saved")
	}
}
