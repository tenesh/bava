// Package logs keeps Bava's own log files: one per session, in the platform
// log folder, pruned at startup.
//
// Nothing here leaves the machine. Logs exist so a user can see what went
// wrong and choose to hand it over; there is no upload of any kind. They are
// Bava's own state, not work product: deleting them costs history, never work.
//
// A log never contains document content, D2 source, AI prompts or replies, or
// credentials. That is a rule for callers (this package cannot tell content
// from a message), but it does redact the one thing every path carries: the
// user's home directory, written as "~".
package logs

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Retention defaults, decided 2026-09-17.
const (
	DefaultKeepSessions = 10
	DefaultMaxBytes     = 50 << 20
)

// markerSuffix names the file each running session leaves behind,
// "<session>.running", holding its PID. A marker whose process is gone means
// that session never closed cleanly. One marker per session, so two windows of
// Bava at once neither report each other as crashed nor prune each other's
// live logs.
const markerSuffix = ".running"

func markerFor(session string) string {
	return strings.TrimSuffix(session, ".log") + markerSuffix
}

// Env is the part of the environment Dir needs, injected so every platform's
// folder can be tested on one machine.
type Env struct {
	Home         string
	LocalAppData string
	XDGStateHome string
}

// EnvFromOS reads Env from the running process.
func EnvFromOS() Env {
	home, _ := os.UserHomeDir()
	return Env{
		Home:         home,
		LocalAppData: os.Getenv("LOCALAPPDATA"),
		XDGStateHome: os.Getenv("XDG_STATE_HOME"),
	}
}

// Dir is where logs live on goos: the folder each platform's own tools look
// in first.
func Dir(goos string, env Env) (string, error) {
	switch goos {
	case "darwin":
		if env.Home == "" {
			return "", errors.New("logs: no home directory")
		}
		return filepath.Join(env.Home, "Library", "Logs", "Bava"), nil
	case "windows":
		if env.LocalAppData == "" {
			return "", errors.New("logs: LOCALAPPDATA is not set")
		}
		return filepath.Join(env.LocalAppData, "Bava", "logs"), nil
	default:
		if env.XDGStateHome != "" {
			return filepath.Join(env.XDGStateHome, "bava", "logs"), nil
		}
		if env.Home == "" {
			return "", errors.New("logs: no home directory")
		}
		return filepath.Join(env.Home, ".local", "state", "bava", "logs"), nil
	}
}

// Options configure a session. Zero values take the defaults.
type Options struct {
	Dir     string
	Now     time.Time
	PID     int
	Verbose bool
	// Home is redacted to "~" wherever it appears.
	Home         string
	KeepSessions int
	// MaxBytes caps the whole folder at startup, and a single session while it
	// runs.
	MaxBytes int64
}

// Ended describes how the previous session finished.
type Ended struct {
	Unexpected bool
	// Session is the previous session's file name, when it ended unexpectedly.
	Session string
}

// Session is one run of the app and its log file.
type Session struct {
	Logger *slog.Logger
	// Name is the session's file name within Dir.
	Name     string
	Dir      string
	Previous Ended

	level  *slog.LevelVar
	writer *cappedWriter
	home   string
}

// Start opens a new session: reads how earlier sessions ended, writes this
// one's marker, prunes old sessions and opens the log file.
func Start(o Options) (*Session, error) {
	if o.KeepSessions <= 0 {
		o.KeepSessions = DefaultKeepSessions
	}
	if o.MaxBytes <= 0 {
		o.MaxBytes = DefaultMaxBytes
	}
	if o.Now.IsZero() {
		o.Now = time.Now()
	}
	if o.PID == 0 {
		o.PID = os.Getpid()
	}
	// Owner-only: logs describe what someone did, and a fallback folder may
	// sit somewhere other users can list.
	if err := os.MkdirAll(o.Dir, 0o700); err != nil {
		return nil, fmt.Errorf("create log folder: %w", err)
	}
	_ = os.Chmod(o.Dir, 0o700)

	name := fmt.Sprintf("%s-%d.log", o.Now.UTC().Format("2006-01-02T15-04-05"), o.PID)
	previous := claimDeadSessions(o.Dir)
	if err := os.WriteFile(filepath.Join(o.Dir, markerFor(name)), []byte(strconv.Itoa(o.PID)), 0o600); err != nil {
		return nil, fmt.Errorf("write session marker: %w", err)
	}

	writer, err := newCappedWriter(filepath.Join(o.Dir, name), o.MaxBytes)
	if err != nil {
		os.Remove(filepath.Join(o.Dir, markerFor(name)))
		return nil, err
	}

	level := &slog.LevelVar{}
	session := &Session{Name: name, Dir: o.Dir, Previous: previous, level: level, writer: writer, home: o.Home}
	session.SetVerbose(o.Verbose)
	session.Logger = slog.New(slog.NewTextHandler(writer, &slog.HandlerOptions{
		Level:       level,
		ReplaceAttr: redactHome(o.Home),
	}))

	// Recorded at warn so they appear at the default level: a log that does
	// not say when a session began and ended cannot show where a crash sits.
	session.Logger.Warn("session start", "previousEndedUnexpectedly", previous.Unexpected)

	// A folder that cannot be tidied is not a reason to lose this session's log.
	if err := Prune(o.Dir, name, o.KeepSessions, o.MaxBytes); err != nil {
		session.Logger.Warn("could not prune old log sessions", "err", err)
	}
	return session, nil
}

// Discard is a session that records nothing, for when no log folder can be
// used at all. The app still starts; its log is simply empty.
func Discard() *Session {
	level := &slog.LevelVar{}
	return &Session{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		level:  level,
	}
}

// WailsLogger is the logger to hand Wails. Wails logs every bound call's
// arguments and result at debug level (whole documents) and quotes input in
// some warnings. This logger never goes below warn, whatever the verbose
// setting, and keeps each attribute's name but not its value.
func (s *Session) WailsLogger() *slog.Logger {
	if s.writer == nil {
		return s.Logger
	}
	return slog.New(slog.NewTextHandler(s.writer, &slog.HandlerOptions{
		Level: slog.LevelWarn,
		ReplaceAttr: func(groups []string, attr slog.Attr) slog.Attr {
			if len(groups) == 0 {
				switch attr.Key {
				case slog.TimeKey, slog.LevelKey:
					return attr
				case slog.MessageKey:
					return redactHome(s.home)(groups, attr)
				}
			}
			return slog.String(attr.Key, "[redacted]")
		},
	}))
}

// SetVerbose switches between warnings-and-errors and full debug detail.
func (s *Session) SetVerbose(on bool) {
	if on {
		s.level.Set(slog.LevelDebug)
	} else {
		s.level.Set(slog.LevelWarn)
	}
}

// Path is the session's log file, or "" for a discard session.
func (s *Session) Path() string {
	if s.writer == nil {
		return ""
	}
	return filepath.Join(s.Dir, s.Name)
}

// Close records a clean end and removes the marker.
func (s *Session) Close() error {
	if s.writer == nil {
		return nil
	}
	s.Logger.Warn("session end")
	err := s.writer.Close()
	if removeErr := os.Remove(filepath.Join(s.Dir, markerFor(s.Name))); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
		err = errors.Join(err, removeErr)
	}
	return err
}

// Tail returns up to n of the session's most recent lines.
func (s *Session) Tail(n int) ([]string, error) {
	if s.writer == nil {
		return nil, nil
	}
	s.writer.mu.Lock()
	defer s.writer.mu.Unlock()
	file, err := os.Open(s.Path())
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
		if len(lines) > n {
			lines = lines[1:]
		}
	}
	return lines, scanner.Err()
}

// claimDeadSessions finds sessions whose marker remains but whose process is
// gone, removes those markers so each crash is reported once, and returns the
// most recent.
func claimDeadSessions(dir string) Ended {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return Ended{}
	}
	var dead []string
	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasSuffix(name, markerSuffix) {
			continue
		}
		if markerAlive(filepath.Join(dir, name)) {
			continue
		}
		dead = append(dead, strings.TrimSuffix(name, markerSuffix)+".log")
		os.Remove(filepath.Join(dir, name))
	}
	if len(dead) == 0 {
		return Ended{}
	}
	sort.Strings(dead)
	return Ended{Unexpected: true, Session: dead[len(dead)-1]}
}

func markerAlive(path string) bool {
	content, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(content)))
	return err == nil && processAlive(pid)
}

// Prune deletes the oldest sessions beyond keep, then the oldest until the
// folder is within maxBytes. current is never deleted.
func Prune(dir, current string, keep int, maxBytes int64) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read log folder: %w", err)
	}

	var sessions []string
	sizes := map[string]int64{}
	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasSuffix(name, ".log") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		session := strings.TrimSuffix(strings.TrimSuffix(name, ".log"), ".1") + ".log"
		sizes[session] += info.Size()
		if !strings.HasSuffix(name, ".1.log") {
			sessions = append(sessions, name)
		}
	}
	// Names start with a UTC timestamp, so name order is age order.
	sort.Strings(sessions)

	remove := func(session string) error {
		stem := strings.TrimSuffix(session, ".log")
		for _, name := range []string{session, stem + ".1.log"} {
			if err := os.Remove(filepath.Join(dir, name)); err != nil && !errors.Is(err, os.ErrNotExist) {
				return err
			}
		}
		delete(sizes, session)
		return nil
	}

	// A roll whose session file is gone belongs to nothing and is never
	// otherwise reached.
	for session := range sizes {
		if !contains(sessions, session) {
			stem := strings.TrimSuffix(session, ".log")
			if err := os.Remove(filepath.Join(dir, stem+".1.log")); err != nil && !errors.Is(err, os.ErrNotExist) {
				return err
			}
			delete(sizes, session)
		}
	}

	var older []string
	for _, s := range sessions {
		// Neither this session nor another Bava still running is pruned.
		if s != current && !markerAlive(filepath.Join(dir, markerFor(s))) {
			older = append(older, s)
		}
	}
	for len(older)+1 > keep && len(older) > 0 {
		if err := remove(older[0]); err != nil {
			return err
		}
		older = older[1:]
	}

	total := func() int64 {
		var sum int64
		for _, size := range sizes {
			sum += size
		}
		return sum
	}
	for total() > maxBytes && len(older) > 0 {
		if err := remove(older[0]); err != nil {
			return err
		}
		older = older[1:]
	}
	return nil
}

func contains(list []string, value string) bool {
	for _, item := range list {
		if item == value {
			return true
		}
	}
	return false
}

// redactHome rewrites the home directory to "~" in the message and in every
// string or error attribute.
func redactHome(home string) func([]string, slog.Attr) slog.Attr {
	return func(_ []string, attr slog.Attr) slog.Attr {
		if home == "" {
			return attr
		}
		switch attr.Value.Kind() {
		case slog.KindString:
			attr.Value = slog.StringValue(strings.ReplaceAll(attr.Value.String(), home, "~"))
		case slog.KindAny:
			switch v := attr.Value.Any().(type) {
			case error:
				attr.Value = slog.StringValue(strings.ReplaceAll(v.Error(), home, "~"))
			case fmt.Stringer:
				attr.Value = slog.StringValue(strings.ReplaceAll(v.String(), home, "~"))
			}
		}
		return attr
	}
}

// cappedWriter appends to a file until it would pass max bytes, then moves it
// aside as <name>.1.log, replacing an earlier one, and starts afresh, so the
// newest lines are always kept and a live file is never rewritten.
type cappedWriter struct {
	mu   sync.Mutex
	path string
	max  int64
	file *os.File
	size int64
}

func newCappedWriter(path string, max int64) (*cappedWriter, error) {
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return nil, fmt.Errorf("open log file: %w", err)
	}
	info, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, err
	}
	return &cappedWriter{path: path, max: max, file: file, size: info.Size()}, nil
}

func (w *cappedWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.size+int64(len(p)) > w.max && w.size > 0 {
		if err := w.roll(); err != nil {
			return 0, err
		}
	}
	n, err := w.file.Write(p)
	w.size += int64(n)
	return n, err
}

func (w *cappedWriter) roll() error {
	if err := w.file.Close(); err != nil {
		return err
	}
	rolled := strings.TrimSuffix(w.path, ".log") + ".1.log"
	renameErr := os.Rename(w.path, rolled)
	flags := os.O_CREATE | os.O_WRONLY | os.O_TRUNC
	if renameErr != nil {
		// Another program has the file locked (common on Windows). Keep
		// writing past the cap rather than stop logging for the session.
		flags = os.O_CREATE | os.O_WRONLY | os.O_APPEND
	}
	file, err := os.OpenFile(w.path, flags, 0o600)
	if err != nil {
		return err
	}
	w.file = file
	if renameErr == nil {
		w.size = 0
	} else if info, statErr := file.Stat(); statErr == nil {
		// Measured from the file, and the cap doubled for the rest of the run,
		// so a locked file does not trigger a failed roll on every line.
		w.size = info.Size()
		w.max *= 2
	}
	return nil
}

func (w *cappedWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.file.Close()
}
