package app

import (
	"context"
	"errors"
	"fmt"

	"github.com/tharabyte/bava/internal/space"
)

// ProgressEvent carries how far a long task has got (an import, a zip being
// written), as a Progress.
const ProgressEvent = "progress"

// Progress is one step of a long task: Task names it ("import", "zip").
type Progress struct {
	Task  string `json:"task"`
	Done  int    `json:"done"`
	Total int    `json:"total"`
}

// CodeCancelled is the code of a task the user cancelled: nothing it began
// is left behind, and there is nothing to report.
const CodeCancelled = "cancelled"

// ImportPlanResult is what an import would bring, before anything is written.
type ImportPlanResult struct {
	Plan  space.ImportPlan `json:"plan"`
	Error string           `json:"error"`
	Code  string           `json:"code"`
}

// ImportResult is what an import brought.
type ImportResult struct {
	Result space.ImportResult `json:"result"`
	Error  string             `json:"error"`
	Code   string             `json:"code"`
}

// ImportPlan lists what importing sources (pages, folders or zips the user
// picked) into the folder into would bring, as space.Space.ImportPlan does.
// Only what the user picked is read.
func (s *SpaceService) ImportPlan(root string, sources []string, into string) ImportPlanResult {
	sp, err := s.importable(root, sources)
	if err != nil {
		return ImportPlanResult{Plan: emptyPlan(), Error: err.Error(), Code: space.Code(err)}
	}
	plan, err := sp.ImportPlan(sources, into)
	if err != nil {
		return ImportPlanResult{Plan: emptyPlan(), Error: err.Error(), Code: space.Code(err)}
	}
	return ImportPlanResult{Plan: plan}
}

// Import brings sources into the folder into, planned afresh, telling the
// page how far it has got. Cancel(run) stops it and removes what it made:
// the result's Code is then CodeCancelled.
func (s *SpaceService) Import(ctx context.Context, root, run string, sources []string, into string) ImportResult {
	ctx, done := s.options.Runs.start(ctx, run)
	defer done()
	sp, err := s.importable(root, sources)
	if err != nil {
		return ImportResult{Result: emptyResult(), Error: err.Error(), Code: space.Code(err)}
	}
	res, err := sp.Import(ctx, sources, into, func(done, total int) {
		if s.options.Progress != nil {
			s.options.Progress(Progress{Task: "import", Done: done, Total: total})
		}
	})
	if errors.Is(err, context.Canceled) {
		return ImportResult{Result: emptyResult(), Error: err.Error(), Code: CodeCancelled}
	}
	if err != nil {
		return ImportResult{Result: emptyResult(), Error: err.Error(), Code: space.Code(err)}
	}
	return ImportResult{Result: res}
}

// importable is the Space, once every source is one the user picked: a page
// cannot have Bava read a file it was never shown.
func (s *SpaceService) importable(root string, sources []string) (space.Space, error) {
	sp, err := space.Load(root)
	if err != nil {
		return space.Space{}, err
	}
	for _, source := range sources {
		if s.options.Access != nil && !s.options.Access.Granted(source) {
			return space.Space{}, fmt.Errorf("%s was not chosen: %w", source, space.ErrOutside)
		}
	}
	return sp, nil
}

func emptyPlan() space.ImportPlan {
	return space.ImportPlan{Origins: []space.ImportOrigin{}, Entries: []space.ImportEntry{}, Renames: []space.ImportRename{}}
}

func emptyResult() space.ImportResult {
	return space.ImportResult{Plan: emptyPlan(), Pages: []space.ImportedPage{}, Attached: map[string]string{}}
}
