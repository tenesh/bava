package e2e

import (
	"context"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"

	"github.com/pdfcpu/pdfcpu/pkg/api"
)

// CheckPDF reads a PDF the app wrote in the scratch folder against a
// "pdffile" step's text: min= the fewest sheets it may have, first= and
// last= the first and last sheet's size in millimetres (WxH), each to
// within a millimetre. Returns an error message, or "".
func (s *Service) CheckPDF(path, text string) string {
	if s.options.Scratch == "" {
		return "pdf " + path + ": no scratch folder"
	}
	root, err := os.OpenRoot(s.options.Scratch)
	if err != nil {
		return fmt.Sprintf("pdf %s: %v", path, err)
	}
	defer root.Close()
	f, err := root.Open(path)
	if err != nil {
		return fmt.Sprintf("pdf %s: %v", path, err)
	}
	defer f.Close()
	conf, err := api.LoadConfiguration(api.ConfigurationOptions{Mode: api.ConfigurationModeStateless})
	if err != nil {
		return fmt.Sprintf("pdf %s: %v", path, err)
	}
	dims, err := api.PageDims(context.Background(), f, conf)
	if err != nil {
		return fmt.Sprintf("pdf %s: %v", path, err)
	}
	mm := func(pt float64) float64 { return pt * 25.4 / 72 }
	for _, field := range strings.Fields(text) {
		key, value, _ := strings.Cut(field, "=")
		switch key {
		case "min":
			n, err := strconv.Atoi(value)
			if err != nil {
				return fmt.Sprintf("pdf %s: min=%s is not a number", path, value)
			}
			if len(dims) < n {
				return fmt.Sprintf("pdf %s: %d sheets; want at least %d", path, len(dims), n)
			}
		case "first", "last":
			w, h, ok := strings.Cut(value, "x")
			width, err1 := strconv.ParseFloat(w, 64)
			height, err2 := strconv.ParseFloat(h, 64)
			if !ok || err1 != nil || err2 != nil {
				return fmt.Sprintf("pdf %s: %s=%s is not WxH", path, key, value)
			}
			if len(dims) == 0 {
				return fmt.Sprintf("pdf %s: no sheets", path)
			}
			d := dims[0]
			if key == "last" {
				d = dims[len(dims)-1]
			}
			if math.Abs(mm(d.Width)-width) > 1 || math.Abs(mm(d.Height)-height) > 1 {
				return fmt.Sprintf("pdf %s: the %s sheet is %.1f × %.1f mm; want %s", path, key, mm(d.Width), mm(d.Height), value)
			}
		default:
			return fmt.Sprintf("pdf %s: unknown check %q", path, key)
		}
	}
	return ""
}
