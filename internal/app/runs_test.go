package app

import (
	"context"
	"testing"
)

func TestStoppingARunCancelsItsContext(t *testing.T) {
	r := NewRuns()
	ctx, done := r.start(context.Background(), "run-1")
	defer done()
	r.Stop("run-1")
	if ctx.Err() == nil {
		t.Error("the run was not stopped")
	}
}

// Cancel can reach Go before the call it stops does.
func TestARunStoppedBeforeItStartsStartsStopped(t *testing.T) {
	r := NewRuns()
	r.Stop("run-1")
	ctx, done := r.start(context.Background(), "run-1")
	defer done()
	if ctx.Err() == nil {
		t.Error("a run stopped before it started went ahead")
	}
	again, doneAgain := r.start(context.Background(), "run-2")
	defer doneAgain()
	if again.Err() != nil {
		t.Error("another run was stopped too")
	}
}

func TestAFinishedRunForgetsItsName(t *testing.T) {
	r := NewRuns()
	_, done := r.start(context.Background(), "run-1")
	done()
	if len(r.cancels) != 0 {
		t.Errorf("runs = %v, want none", r.cancels)
	}
}

func TestARunWithoutANameCannotBeStoppedButStillRuns(t *testing.T) {
	r := NewRuns()
	ctx, done := r.start(context.Background(), "")
	defer done()
	r.Stop("")
	if ctx.Err() != nil {
		t.Error("a run without a name was stopped")
	}
}

// A finished run's end never takes a later run of the same name with it.
func TestAnOldRunsEndLeavesALaterRunOfItsNameStoppable(t *testing.T) {
	r := NewRuns()
	_, oldDone := r.start(context.Background(), "run-1")
	ctx, done := r.start(context.Background(), "run-1")
	defer done()
	oldDone()
	r.Stop("run-1")
	if ctx.Err() == nil {
		t.Error("the later run could not be stopped")
	}
}
