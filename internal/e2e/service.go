package e2e

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

// Options are what the service needs from its host: the scenario, where
// screenshots and the result go, how to take a screenshot, and how to quit.
type Options struct {
	Scenario Scenario
	Out      string
	Capture  func(path string) error
	Quit     func(code int)
}

// Service is bound to the page in a -tags e2e build: the page's driver asks
// it for the scenario, for screenshots, and reports how the run ended.
type Service struct {
	options Options
	mu      sync.Mutex
	shots   int
}

// NewService is the service a -tags e2e build registers.
func NewService(options Options) *Service {
	return &Service{options: options}
}

// Scenario is the walk the page runs.
func (s *Service) Scenario() Scenario {
	return s.options.Scenario
}

var unsafeName = regexp.MustCompile(`[^a-z0-9]+`)

// Shot saves a screenshot of the screen, numbered in the order taken.
// Returns an error message, or "".
func (s *Service) Shot(name string) string {
	s.mu.Lock()
	s.shots++
	n := s.shots
	s.mu.Unlock()
	slug := unsafeName.ReplaceAllString(strings.ToLower(name), "-")
	path := filepath.Join(s.options.Out, fmt.Sprintf("%s-%02d-%s.png", s.options.Scenario.Name, n, slug))
	if err := s.options.Capture(path); err != nil {
		return fmt.Sprintf("shot %q: %v", name, err)
	}
	return ""
}

// Done records how the run ended, PASS or FAIL with the reason, and quits
// with a matching exit code. An empty failure means it passed.
func (s *Service) Done(failure string) {
	result, code := "PASS\n", 0
	if failure != "" {
		result, code = "FAIL "+failure+"\n", 1
	}
	path := filepath.Join(s.options.Out, s.options.Scenario.Name+"-result.txt")
	if err := os.WriteFile(path, []byte(result), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "e2e: %v\n", err)
		code = 1
	}
	fmt.Print(result)
	s.options.Quit(code)
}
