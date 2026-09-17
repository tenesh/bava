package app_test

import (
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tenesh/bava/internal/app"
)

type events struct {
	mu   sync.Mutex
	sent []app.AppError
}

func (e *events) emit(err app.AppError) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.sent = append(e.sent, err)
}

// A panic in work Bava starts must be logged and shown, not end the process:
// Wails' default is os.Exit(1), and an app that vanishes says nothing.
func TestGoRecoversLogsAndEmits(t *testing.T) {
	_, session, _ := logService(t)
	var sink events
	done := make(chan struct{})

	app.Go(session.Logger, sink.emit, func() {
		defer close(done)
		panic("worker exploded")
	})
	<-done
	app.WaitForWork()

	text := logText(t, session)
	if !strings.Contains(text, "worker exploded") || !strings.Contains(text, "recover_test.go") {
		t.Errorf("the panic and its stack were not logged:\n%s", text)
	}
	if len(sink.sent) != 1 {
		t.Fatalf("emitted %d errors, want 1", len(sink.sent))
	}
	if sink.sent[0].ID == "" {
		t.Errorf("the emitted error should carry an id: %+v", sink.sent[0])
	}
}

func TestPanicHandlerLogsWithoutExiting(t *testing.T) {
	_, session, _ := logService(t)
	var sink events
	handler := app.PanicHandler(session.Logger, sink.emit)

	handler(&application.PanicDetails{Error: errors.New("bound method broke"), StackTrace: "goroutine 1 [running]:\nmain.go:12"})

	text := logText(t, session)
	if !strings.Contains(text, "bound method broke") || !strings.Contains(text, "main.go:12") {
		t.Errorf("the panic was not logged with its stack:\n%s", text)
	}
	if len(sink.sent) != 1 {
		t.Errorf("emitted %d errors, want 1", len(sink.sent))
	}
}

// Wails' InvokeSync marks its caller done only after fn returns, so a panic
// there leaves the caller waiting forever if the handler returns. Exiting is
// the lesser harm: the next launch reports the unexpected exit.
func TestPanicInsideInvokeSyncExits(t *testing.T) {
	_, session, _ := logService(t)
	exited := -1
	handler := app.PanicHandlerWithExit(session.Logger, nil, func(code int) { exited = code })

	handler(&application.PanicDetails{
		Error:          errors.New("boom"),
		FullStackTrace: "goroutine 1 [running]:\ngithub.com/wailsapp/wails/v3/pkg/application.InvokeSync.func1()",
	})
	if exited != 1 {
		t.Errorf("exit code %d, want 1", exited)
	}

	exited = -1
	handler(&application.PanicDetails{Error: errors.New("boom"), FullStackTrace: "goroutine 7 [running]:\nmain.work()"})
	if exited != -1 {
		t.Error("a panic outside InvokeSync exited")
	}
}
