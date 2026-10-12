package app

import (
	"context"
	"sync"
)

// Runs are the long tasks under way that the page can stop by the name it
// gave them: an import, a zip or a PDF being written. Stopping one cancels
// its context, and the call still answers, once it has undone what it
// began, so the page learns how it really ended.
type Runs struct {
	mu      sync.Mutex
	cancels map[string]*context.CancelFunc
	// stopped are runs stopped before they started: Cancel can reach Go
	// before the call it stops.
	stopped map[string]bool
}

// NewRuns makes an empty set of runs, shared by the services that start them.
func NewRuns() *Runs {
	return &Runs{cancels: map[string]*context.CancelFunc{}, stopped: map[string]bool{}}
}

// start begins the run named name under parent; done ends it. A run with no
// name cannot be stopped.
func (r *Runs) start(parent context.Context, name string) (context.Context, func()) {
	ctx, cancel := context.WithCancel(parent)
	if name == "" {
		return ctx, cancel
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.stopped[name] {
		delete(r.stopped, name)
		cancel()
	}
	own := &cancel
	r.cancels[name] = own
	return ctx, func() {
		r.mu.Lock()
		// A later run may have taken the name: its entry stays.
		if r.cancels[name] == own {
			delete(r.cancels, name)
		}
		r.mu.Unlock()
		cancel()
	}
}

// Stop stops the run named name, now or as it starts.
func (r *Runs) Stop(name string) {
	if name == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if cancel, ok := r.cancels[name]; ok {
		(*cancel)()
		return
	}
	r.stopped[name] = true
}
