package app

import (
	"context"
	"fmt"
	"log/slog"
	"runtime"
	"runtime/debug"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/tenesh/bava/internal/logs"
)

// Frontend reports are capped so a failure in a loop cannot fill the disk:
// at most reportLimit per reportWindow, then one line saying how many were
// dropped.
const (
	reportLimit    = 20
	reportWindow   = 10 * time.Second
	maxKindLen     = 200
	maxStackLen    = 8000
	diagnosticTail = 200
)

// Notice kinds: things the user is told once, at the next chance.
const (
	NoticeUnexpectedExit  = "unexpectedExit"
	NoticeWebviewReloaded = "webviewReloaded"
)

// LogEntry is an error the frontend reports. It carries the error's kind and
// stack frames, never its message: JavaScript messages quote input (a JSON
// syntax error shows the text it choked on), and a thrown value can be anything.
type LogEntry struct {
	Level string `json:"level"`
	// Kind is the error's constructor name ("TypeError"), or the thrown
	// value's type.
	Kind  string `json:"kind"`
	Stack string `json:"stack"`
	// Source says where it was caught: "window", "rejection", "boundary", or a
	// module name.
	Source string `json:"source"`
}

// Notice is something the user should be told once.
type Notice struct {
	Kind string `json:"kind"`
	// Session is the log file of the session concerned, when there is one.
	Session string `json:"session"`
}

// LogServiceOptions wire the service to its session and to the platform.
// Functions are injected so the service is testable without a running app.
type LogServiceOptions struct {
	Session     *logs.Session
	Now         func() time.Time
	OSVersion   func() string
	OpenFolder  func(path string) error
	SaveVerbose func(on bool) error
}

// LogService is the frontend's way into Bava's log. Nothing it does leaves
// the machine: Diagnostics returns text for the user to copy, and
// OpenLogsFolder opens a local folder.
type LogService struct {
	options LogServiceOptions

	mu          sync.Mutex
	windowStart time.Time
	inWindow    int
	suppressed  int
	notices     []Notice
}

// NewLogService constructs the service registered with the application.
func NewLogService(options LogServiceOptions) *LogService {
	if options.Now == nil {
		options.Now = time.Now
	}
	if options.OSVersion == nil {
		options.OSVersion = func() string { return "unknown" }
	}
	service := &LogService{options: options}
	if previous := options.Session.Previous; previous.Unexpected {
		service.notices = append(service.notices, Notice{Kind: NoticeUnexpectedExit, Session: previous.Session})
	}
	return service
}

func (s *LogService) logger() *slog.Logger { return s.options.Session.Logger }

// Report writes a frontend error to the log.
func (s *LogService) Report(entry LogEntry) {
	s.mu.Lock()
	now := s.options.Now()
	if now.Sub(s.windowStart) >= reportWindow {
		if s.suppressed > 0 {
			// Noted when the next report arrives, not when the window closes: a
			// burst that ends the session goes unrecorded.
			s.logger().Warn("frontend reports dropped by the rate limit", "suppressed", s.suppressed)
		}
		s.windowStart, s.inWindow, s.suppressed = now, 0, 0
	}
	if s.inWindow >= reportLimit {
		s.suppressed++
		s.mu.Unlock()
		return
	}
	s.inWindow++
	s.mu.Unlock()

	level := slog.LevelError
	if entry.Level == "warn" {
		level = slog.LevelWarn
	}
	s.logger().Log(context.Background(), level, "frontend error",
		"source", entry.Source,
		"kind", truncate(entry.Kind, maxKindLen),
		"stack", truncate(entry.Stack, maxStackLen),
	)
}

// Diagnostics returns a plain-text report for the user to copy: the build,
// the platform, and the session's recent log lines, already redacted.
func (s *LogService) Diagnostics(userAgent string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Bava diagnostics\n\n")
	fmt.Fprintf(&b, "Version: %s\n", buildVersion())
	fmt.Fprintf(&b, "OS: %s %s (%s)\n", runtime.GOOS, s.options.OSVersion(), runtime.GOARCH)
	fmt.Fprintf(&b, "Webview: %s\n", userAgent)
	fmt.Fprintf(&b, "Previous session ended unexpectedly: %t\n", s.options.Session.Previous.Unexpected)
	fmt.Fprintf(&b, "Log file: %s\n\n", s.options.Session.Name)

	lines, err := s.options.Session.Tail(diagnosticTail)
	if err != nil {
		fmt.Fprintf(&b, "(recent log lines unavailable: %v)\n", err)
		return b.String()
	}
	fmt.Fprintf(&b, "Recent log lines:\n%s\n", strings.Join(lines, "\n"))
	return b.String()
}

// OpenLogsFolder reveals the log folder in the platform's file manager.
// Returns an error message, or "" on success.
func (s *LogService) OpenLogsFolder() string {
	if s.options.OpenFolder == nil {
		return "opening folders is unavailable"
	}
	if err := s.options.OpenFolder(s.options.Session.Dir); err != nil {
		s.logger().Warn("could not open the log folder", "err", err)
		return err.Error()
	}
	return ""
}

// TakeNotices returns pending notices once; a second call returns none.
func (s *LogService) TakeNotices() []Notice {
	s.mu.Lock()
	defer s.mu.Unlock()
	notices := s.notices
	s.notices = nil
	return notices
}

// SetVerbose switches debug detail on or off and saves the preference.
// Returns an error message, or "" on success.
func (s *LogService) SetVerbose(on bool) string {
	// Saved first: if the preference cannot be written, the live level stays
	// as the screen shows it.
	if s.options.SaveVerbose != nil {
		if err := s.options.SaveVerbose(on); err != nil {
			return err.Error()
		}
	}
	s.options.Session.SetVerbose(on)
	return ""
}

// addNotice queues a notice for the frontend. Unexported, so it is not bound:
// only Go decides what the user is told.
func (s *LogService) addNotice(n Notice) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.notices = append(s.notices, n)
}

func buildVersion() string {
	info, ok := debug.ReadBuildInfo()
	if !ok || info.Main.Version == "" || info.Main.Version == "(devel)" {
		// There is no version stamping until Milestone 16. A made-up number
		// here would be a false fact in the one place people look for truth.
		return "unstamped development build"
	}
	return info.Main.Version
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	// Back off to the start of a character rather than split one.
	for max > 0 && !utf8.RuneStart(s[max]) {
		max--
	}
	return s[:max] + "…(truncated)"
}
