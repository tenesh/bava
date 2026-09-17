package app

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"os"
	"runtime/debug"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// AppErrorEvent is emitted when Go recovers from something unexpected.
const AppErrorEvent = "app:error"

// AppError is what the frontend is told about an unexpected failure: an id
// that finds the entry in the log. The frontend supplies the words, in the
// user's language; the stack and the panic stay in the log.
type AppError struct {
	ID string `json:"id"`
}

var work sync.WaitGroup

// Go runs fn on a new goroutine that cannot take the app down. A panic is
// logged with its stack and reported through emit; the goroutine ends and the
// app carries on. Every goroutine Bava starts goes through here — Wails only
// recovers the ones it starts itself, and its default reaction is to exit.
func Go(logger *slog.Logger, emit func(AppError), fn func()) {
	work.Add(1)
	go func() {
		defer work.Done()
		defer func() {
			if value := recover(); value != nil {
				report(logger, emit, fmt.Errorf("%v", value), string(debug.Stack()))
			}
		}()
		fn()
	}()
}

// WaitForWork blocks until every goroutine started with Go has returned, for
// shutdown and tests.
func WaitForWork() { work.Wait() }

// PanicHandler is Bava's application.Options.PanicHandler. Wails has already
// recovered the goroutine by the time it is called, so logging and telling the
// user is enough — with one exception, below — and unlike Wails' default it
// does not exit.
func PanicHandler(logger *slog.Logger, emit func(AppError)) func(*application.PanicDetails) {
	return PanicHandlerWithExit(logger, emit, os.Exit)
}

// PanicHandlerWithExit is PanicHandler with the exit injectable.
//
// Wails' InvokeSync runs fn on the main thread as `defer handlePanic(); fn();
// wg.Done()` — Done is not deferred. A panic there leaves the caller blocked on
// wg.Wait() forever if the handler returns: a bound call that never answers, or
// a quit that never finishes. Exiting is the lesser harm: the session is left
// open, so the next launch reports the unexpected exit.
func PanicHandlerWithExit(logger *slog.Logger, emit func(AppError), exit func(int)) func(*application.PanicDetails) {
	return func(details *application.PanicDetails) {
		stack := details.StackTrace
		if details.FullStackTrace != "" {
			stack = details.FullStackTrace
		}
		if strings.Contains(stack, "application.InvokeSync") {
			logger.Error("panic on the main thread inside InvokeSync; exiting, as its caller would wait forever",
				"err", details.Error, "stack", stack)
			exit(1)
			return
		}
		report(logger, emit, details.Error, stack)
	}
}

// report logs a recovered panic. The panic value is logged as it is: panic
// messages are written by code, never built from user content — a rule for
// every panic in Bava (.ai/rules/logging.md).
func report(logger *slog.Logger, emit func(AppError), err error, stack string) {
	id := newErrorID()
	logger.Error("recovered from a panic", "errorId", id, "err", err, "stack", stack)
	if emit != nil {
		emit(AppError{ID: id})
	}
}

func newErrorID() string {
	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b[:])
}
