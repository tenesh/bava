//go:build !windows

package logs

import (
	"errors"
	"syscall"
)

// processAlive reports whether pid is a running process. Signal 0 checks
// existence without delivering anything; EPERM means it exists but belongs
// to someone else.
func processAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	err := syscall.Kill(pid, 0)
	return err == nil || errors.Is(err, syscall.EPERM)
}
