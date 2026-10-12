package app_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/tharabyte/bava/internal/access"
	"github.com/tharabyte/bava/internal/app"
	"github.com/tharabyte/bava/internal/space"
	"github.com/tharabyte/bava/internal/testutil"
)

// importing is a Space, a service that keeps what the user picks, and a
// folder of notes on disk the user picked.
func importing(t *testing.T, progress func(app.Progress)) (*app.SpaceService, space.Space, string) {
	t.Helper()
	s, err := space.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	grants, err := access.Open(filepath.Join(t.TempDir(), "access.json"), access.None{})
	if err != nil {
		t.Fatal(err)
	}
	src := t.TempDir()
	testutil.WriteTree(t, src, map[string]string{"Notes/A.md": "# A\n", "Notes/B.md": "# B\n"})
	notes := filepath.Join(src, "Notes")
	if err := grants.Allow(notes); err != nil {
		t.Fatal(err)
	}
	return app.NewSpaceService(app.SpaceServiceOptions{Access: grants, Progress: progress}), s, notes
}

func TestImportPlanListsWhatAnImportBrings(t *testing.T) {
	svc, s, notes := importing(t, nil)
	res := svc.ImportPlan(s.Root, []string{notes}, "")
	if res.Error != "" {
		t.Fatal(res.Error)
	}
	if res.Plan.Pages != 2 || len(res.Plan.Entries) != 3 {
		t.Errorf("plan = %+v, want the folder and its two pages", res.Plan)
	}
}

func TestAnImportReadsOnlyWhatTheUserPicked(t *testing.T) {
	svc, s, _ := importing(t, nil)
	other := t.TempDir()
	testutil.WriteTree(t, other, map[string]string{"Secret.md": "# Secret\n"})
	res := svc.ImportPlan(s.Root, []string{filepath.Join(other, "Secret.md")}, "")
	if res.Code != "outside" {
		t.Errorf("code = %q, want outside for a file never picked", res.Code)
	}
	done := svc.Import(context.Background(), s.Root, "run-1", []string{filepath.Join(other, "Secret.md")}, "")
	if done.Code != "outside" {
		t.Errorf("import code = %q, want outside", done.Code)
	}
	if _, err := os.Stat(filepath.Join(s.Root, "Secret.md")); err == nil {
		t.Error("a file never picked was imported")
	}
}

func TestAnImportSaysHowFarItHasGot(t *testing.T) {
	var seen []app.Progress
	svc, s, notes := importing(t, func(p app.Progress) { seen = append(seen, p) })
	res := svc.Import(context.Background(), s.Root, "run-1", []string{notes}, "")
	if res.Error != "" {
		t.Fatal(res.Error)
	}
	if len(seen) != 3 || seen[2] != (app.Progress{Task: "import", Done: 3, Total: 3}) {
		t.Errorf("progress = %+v, want three steps ending 3 of 3", seen)
	}
	if len(res.Result.Pages) != 2 {
		t.Errorf("pages = %+v", res.Result.Pages)
	}
}

// Cancel stops the run it names, and the call answers once what it made is gone.
func TestACancelledImportSaysSoOnceUndone(t *testing.T) {
	var svc *app.SpaceService
	svc, s, notes := importing(t, func(p app.Progress) {
		if p.Done == 1 {
			svc.Cancel("run-1")
		}
	})
	res := svc.Import(context.Background(), s.Root, "run-1", []string{notes}, "")
	if res.Code != "cancelled" {
		t.Errorf("code = %q, want cancelled", res.Code)
	}
	if _, err := os.Stat(filepath.Join(s.Root, "Notes")); err == nil {
		t.Error("a cancelled import left its folder")
	}
}

func TestTheImportPickerOffersPagesAndZipsAndKeepsThePick(t *testing.T) {
	grants, err := access.Open(filepath.Join(t.TempDir(), "access.json"), access.None{})
	if err != nil {
		t.Fatal(err)
	}
	picked := filepath.Join(t.TempDir(), "Export.zip")
	var asked string
	svc := app.NewFileService(app.FileServiceOptions{Access: grants, ChooseFiles: func(kind string) ([]string, error) {
		asked = kind
		return []string{picked}, nil
	}})
	res := svc.ChooseMedia("import")
	if res.Error != "" || len(res.Paths) != 1 || asked != "import" {
		t.Fatalf("ChooseMedia(import) = %+v, asked %q", res, asked)
	}
	if !grants.Granted(picked) {
		t.Error("the pick was not kept")
	}
}

func TestAZipExportSaysHowFarItHasGotAndCanBeCancelled(t *testing.T) {
	var seen []app.Progress
	svc, s, _ := importing(t, func(p app.Progress) { seen = append(seen, p) })
	if _, err := s.CreatePageWith("", "A", []byte("# A\n")); err != nil {
		t.Fatal(err)
	}
	out := filepath.Join(t.TempDir(), "Space.zip")
	if p := svc.ExportZip(context.Background(), s.Root, "run-1", space.ZipScope{Kind: space.ZipSpace}, out); p.Error != "" {
		t.Fatal(p.Error)
	}
	if len(seen) == 0 || seen[len(seen)-1].Task != "zip" || seen[len(seen)-1].Done != seen[len(seen)-1].Total {
		t.Errorf("progress = %+v, want zip steps ending at the total", seen)
	}
	svc.Cancel("run-2")
	again := filepath.Join(t.TempDir(), "Again.zip")
	if p := svc.ExportZip(context.Background(), s.Root, "run-2", space.ZipScope{Kind: space.ZipSpace}, again); p.Code != "cancelled" {
		t.Errorf("code = %q, want cancelled", p.Code)
	}
	if _, err := os.Stat(again); err == nil {
		t.Error("a cancelled zip was written")
	}
}
