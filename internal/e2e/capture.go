package e2e

import (
	"fmt"
	"os/exec"
	"runtime"
)

// Capture saves a screenshot of the whole screen to path. The smoke runs use
// throwaway CI machines whose screen shows only Bava, so the whole screen is
// the window: Linux's virtual screen through ImageMagick's import, macOS's
// screencapture (the job grants it screen recording), and on Windows a
// PowerShell copy of the primary screen.
func Capture(path string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "linux":
		cmd = exec.Command("import", "-window", "root", path)
	case "darwin":
		cmd = exec.Command("screencapture", "-x", path)
	case "windows":
		script := fmt.Sprintf(`Add-Type -AssemblyName System.Windows.Forms,System.Drawing;`+
			`$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;`+
			`$i=New-Object System.Drawing.Bitmap $b.Width,$b.Height;`+
			`$g=[System.Drawing.Graphics]::FromImage($i);`+
			`$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size);`+
			`$i.Save('%s',[System.Drawing.Imaging.ImageFormat]::Png)`, path)
		cmd = exec.Command("powershell", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script)
	default:
		return fmt.Errorf("no screenshot on %s", runtime.GOOS)
	}
	// PowerShell would otherwise open a console window over the very screen
	// it photographs.
	hideWindow(cmd)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("%v: %s", err, out)
	}
	return nil
}
