//go:build windows

package pdfprint

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"sync"
	"time"
	"unsafe"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// On Windows a hidden Wails window loads the page, and Chromium's own
// Page.printToPDF, called through WebView2 in process (no debugging port),
// returns the PDF. Wails keeps its WebView2 object unexported, in a package
// another module may not import, so it is reached by name at run time
// (chromiumOf); the end-to-end proof on CI fails if a Wails update moves it.

func printPDF(j job, onMain RunOnMain, timeout time.Duration) error {
	app := application.Get()
	if app == nil {
		return errors.New("print to PDF: no running application")
	}
	done := make(chan printed, 1)
	var window *application.WebviewWindow
	var once sync.Once
	var settle *time.Timer
	// Set on the main thread before the window closes: a print still to come
	// (its settle timer, a late navigation) then stops short of it.
	closed := false
	onMain(func() {
		window = app.Window.NewWithOptions(application.WebviewWindowOptions{
			Name:   "bava-print",
			Hidden: true,
			HTML:   j.html,
			Width:  int((j.widthMM - j.margins.Left - j.margins.Right) * pixelsPerMM),
			Height: printWindowHeight,
		})
		window.OnWindowEvent(events.Windows.WebViewNavigationCompleted, func(*application.WindowEvent) {
			once.Do(func() {
				// A moment for layout and fonts to settle before the page is printed.
				settle = time.AfterFunc(settleDelay, func() {
					onMain(func() {
						if !closed {
							printWindow(window, j, done)
						}
					})
				})
			})
		})
	})
	defer onMain(func() {
		closed = true
		if settle != nil {
			settle.Stop()
		}
		if window != nil {
			window.Close()
		}
	})
	select {
	case p := <-done:
		if p.err != nil {
			return fmt.Errorf("print to PDF: %w", p.err)
		}
		if err := os.WriteFile(j.out, p.data, 0o644); err != nil {
			return fmt.Errorf("write %s: %w", j.out, err)
		}
		return nil
	case <-time.After(timeout):
		return errors.New("print to PDF: the system's printing did not finish in time")
	}
}

type printed struct {
	data []byte
	err  error
}

// printWindowHeight is the print window's height in pixels: the page's
// height does not matter, only its width, as the PDF is paginated.
const printWindowHeight = 800

// printWindow asks the window's WebView2 for the PDF. Runs on the main thread.
func printWindow(window *application.WebviewWindow, j job, done chan<- printed) {
	// Only the first report is kept, and none may block the main thread.
	report := func(p printed) {
		select {
		case done <- p:
		default:
		}
	}
	// Reaching into Wails can only fail by a Wails update moving what it
	// reaches: the print fails with that, never the app.
	defer func() {
		if r := recover(); r != nil {
			report(printed{err: fmt.Errorf("reach WebView2: %v", r)})
		}
	}()
	call, err := chromiumOf(window)
	if err != nil {
		report(printed{err: err})
		return
	}
	inches := func(mm float64) float64 { return mm / 25.4 }
	params, _ := json.Marshal(map[string]any{
		"paperWidth":          inches(j.widthMM),
		"paperHeight":         inches(j.heightMM),
		"marginTop":           inches(j.margins.Top),
		"marginRight":         inches(j.margins.Right),
		"marginBottom":        inches(j.margins.Bottom),
		"marginLeft":          inches(j.margins.Left),
		"printBackground":     j.background,
		"preferCSSPageSize":   false,
		"displayHeaderFooter": false,
	})
	reply := func(result string, err error) {
		if err != nil {
			report(printed{err: err})
			return
		}
		var out struct {
			Data string `json:"data"`
		}
		if err := json.Unmarshal([]byte(result), &out); err != nil {
			report(printed{err: fmt.Errorf("read the PDF: %w", err)})
			return
		}
		data, err := base64.StdEncoding.DecodeString(out.Data)
		report(printed{data: data, err: err})
	}
	if err := call("Page.printToPDF", string(params), reply); err != nil {
		report(printed{err: err})
	}
}

// chromiumOf reaches the WebView2 object Wails holds for a window
// (WebviewWindow.impl, a *windowsWebviewWindow, whose chromium field is an
// *edge.Chromium) and returns its CallDevTools method.
func chromiumOf(window *application.WebviewWindow) (func(method, params string, done func(string, error)) error, error) {
	field := func(v reflect.Value, name string) (reflect.Value, error) {
		f := v.FieldByName(name)
		if !f.IsValid() {
			return reflect.Value{}, fmt.Errorf("Wails' window has no %s field", name)
		}
		return reflect.NewAt(f.Type(), unsafe.Pointer(f.UnsafeAddr())).Elem(), nil
	}
	impl, err := field(reflect.ValueOf(window).Elem(), "impl")
	if err != nil {
		return nil, err
	}
	if impl.Kind() != reflect.Interface || impl.IsNil() {
		return nil, errors.New("the print window is gone")
	}
	native := impl.Elem()
	if native.Kind() != reflect.Pointer || native.IsNil() {
		return nil, errors.New("the print window has no native window")
	}
	chromium, err := field(native.Elem(), "chromium")
	if err != nil {
		return nil, err
	}
	if chromium.Kind() != reflect.Pointer || chromium.IsNil() {
		return nil, errors.New("the print window has no WebView2 yet")
	}
	method := chromium.MethodByName("CallDevTools")
	want := reflect.TypeOf((func(string, string, func(string, error)) error)(nil))
	if !method.IsValid() || method.Type() != want {
		return nil, errors.New("Wails' WebView2 has no CallDevTools(method, params, done) error")
	}
	return func(name, params string, done func(string, error)) error {
		out := method.Call([]reflect.Value{reflect.ValueOf(name), reflect.ValueOf(params), reflect.ValueOf(done)})
		if err, _ := out[0].Interface().(error); err != nil {
			return err
		}
		return nil
	}, nil
}
