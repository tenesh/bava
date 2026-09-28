// Package e2e drives the real app through a scenario for the smoke runs on
// CI: the steps a person would take, a screenshot at each shot. Only a build
// with -tags e2e links it; a release build never does.
package e2e

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"sync"
)

// Step is one thing the driver does in the page. Target is a CSS selector,
// or a menu command id for "menu"; Text is what to type, the key to press, or
// the text a "wait" expects inside its target.
type Step struct {
	Do        string    `json:"do"`
	Target    string    `json:"target,omitempty"`
	Text      string    `json:"text,omitempty"`
	Name      string    `json:"name,omitempty"`
	From      []float64 `json:"from,omitempty"`
	To        []float64 `json:"to,omitempty"`
	TimeoutMs int       `json:"timeoutMs,omitempty"`
}

// Scenario is a smoke walk: the folder picker's answers and the media
// picker's (each a list of files, empty for a cancel), in the order the
// pickers are shown, and the steps.
type Scenario struct {
	Name    string     `json:"name"`
	Folders []string   `json:"folders,omitempty"`
	Files   [][]string `json:"files,omitempty"`
	Steps   []Step     `json:"steps"`
}

var variable = regexp.MustCompile(`\$\{([A-Z_]+)\}`)

// expand replaces ${NAME} in an answer with its value in vars.
func expand(answer string, vars map[string]string) (string, error) {
	var missing error
	out := variable.ReplaceAllStringFunc(answer, func(m string) string {
		name := variable.FindStringSubmatch(m)[1]
		value, ok := vars[name]
		if !ok {
			missing = fmt.Errorf("scenario: ${%s} is not set", name)
		}
		return value
	})
	return out, missing
}

// Parse reads a scenario, replacing ${NAME} in picker answers with vars, and
// refuses one that could not run to the end.
func Parse(data []byte, vars map[string]string) (Scenario, error) {
	var sc Scenario
	if err := json.Unmarshal(data, &sc); err != nil {
		return sc, fmt.Errorf("scenario: %w", err)
	}
	if len(sc.Steps) == 0 {
		return sc, errors.New("scenario: no steps")
	}
	for i, folder := range sc.Folders {
		var err error
		if sc.Folders[i], err = expand(folder, vars); err != nil {
			return sc, err
		}
	}
	for i, answer := range sc.Files {
		for j, file := range answer {
			var err error
			if sc.Files[i][j], err = expand(file, vars); err != nil {
				return sc, err
			}
		}
	}
	for i, step := range sc.Steps {
		if err := check(step); err != nil {
			return sc, fmt.Errorf("scenario step %d: %w", i+1, err)
		}
	}
	return sc, nil
}

// Load reads a scenario file.
func Load(path string, vars map[string]string) (Scenario, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Scenario{}, fmt.Errorf("scenario: %w", err)
	}
	return Parse(data, vars)
}

func check(step Step) error {
	switch step.Do {
	case "click", "menu", "gone":
		if step.Target == "" {
			return fmt.Errorf("%q needs a target", step.Do)
		}
	case "wait":
		if step.Target == "" {
			return errors.New(`"wait" needs a target`)
		}
	case "type", "key":
		if step.Text == "" {
			return fmt.Errorf("%q needs text", step.Do)
		}
	case "shot":
		if step.Name == "" {
			return errors.New(`"shot" needs a name`)
		}
	case "drag":
		if step.Target == "" || len(step.From) != 2 || len(step.To) != 2 {
			return errors.New(`"drag" needs a target, and from and to as [x, y]`)
		}
	default:
		return fmt.Errorf("unknown step %q", step.Do)
	}
	return nil
}

// FolderQueue answers the folder picker from a scenario, one answer per
// picker shown.
type FolderQueue struct {
	mu      sync.Mutex
	answers []string
}

// NewFolderQueue holds a scenario's folder answers.
func NewFolderQueue(answers []string) *FolderQueue {
	return &FolderQueue{answers: append([]string(nil), answers...)}
}

// Next is the next answer; a picker shown with none left is a scenario error.
func (q *FolderQueue) Next(title string) (string, error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if len(q.answers) == 0 {
		return "", fmt.Errorf("e2e: the folder picker %q was shown with no answer left", title)
	}
	next := q.answers[0]
	q.answers = q.answers[1:]
	return next, nil
}

// FileQueue answers the media picker from a scenario, one answer per picker
// shown.
type FileQueue struct {
	mu      sync.Mutex
	answers [][]string
}

// NewFileQueue holds a scenario's file answers.
func NewFileQueue(answers [][]string) *FileQueue {
	return &FileQueue{answers: append([][]string(nil), answers...)}
}

// Next is the next answer; a picker shown with none left is a scenario error.
func (q *FileQueue) Next(kind string) ([]string, error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if len(q.answers) == 0 {
		return nil, fmt.Errorf("e2e: the %s picker was shown with no answer left", kind)
	}
	next := q.answers[0]
	q.answers = q.answers[1:]
	return append([]string{}, next...), nil
}
