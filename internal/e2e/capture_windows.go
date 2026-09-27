//go:build windows

package e2e

import (
	"os/exec"
	"syscall"
)

// createNoWindow starts a console program without a console window.
const createNoWindow = 0x08000000

func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
}
