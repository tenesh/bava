//go:build windows

package logs

import "os"

// processAlive reports whether pid is a running process. On Windows,
// FindProcess opens a handle and fails when there is no such process.
func processAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	process.Release()
	return true
}
