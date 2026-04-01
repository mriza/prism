package modules

import (
	"os/exec"
	"path/filepath"
	"prism-agent/internal/protocol"
	"strings"
)

// DetectRuntimes probes the system for common language runtimes
func DetectRuntimes() []protocol.RuntimeInfo {
	runtimes := []protocol.RuntimeInfo{}

	// Node.js
	if info, ok := checkRuntime("node", "-v", "Node.js"); ok {
		runtimes = append(runtimes, info)
	}

	// Python 3
	if info, ok := checkRuntime("python3", "--version", "Python 3"); ok {
		runtimes = append(runtimes, info)
	} else if info, ok := checkRuntime("python", "--version", "Python"); ok {
		runtimes = append(runtimes, info)
	}

	// PHP
	if info, ok := checkRuntime("php", "-v", "PHP"); ok {
		// PHP -v output is multi-line, take first part
		if parts := strings.Split(info.Version, " ("); len(parts) > 0 {
			info.Version = strings.TrimPrefix(parts[0], "PHP ")
		}
		runtimes = append(runtimes, info)
	}

	// Go
	if info, ok := checkRuntime("go", "version", "Go"); ok {
		// go version go1.21.1 linux/amd64
		parts := strings.Fields(info.Version)
		if len(parts) >= 3 {
			info.Version = strings.TrimPrefix(parts[2], "go")
		}
		runtimes = append(runtimes, info)
	}

	// Ruby
	if info, ok := checkRuntime("ruby", "-v", "Ruby"); ok {
		parts := strings.Fields(info.Version)
		if len(parts) >= 2 {
			info.Version = parts[1]
		}
		runtimes = append(runtimes, info)
	}

	return runtimes
}

func checkRuntime(cmdName, versionArg, displayName string) (protocol.RuntimeInfo, bool) {
	path, err := exec.LookPath(cmdName)
	if err != nil {
		return protocol.RuntimeInfo{}, false
	}

	// Resolve symlinks to get the real binary path (e.g. /usr/bin/python -> /usr/bin/python3.11)
	if realPath, err := filepath.EvalSymlinks(path); err == nil {
		path = realPath
	}

	out, err := exec.Command(cmdName, versionArg).Output()
	if err != nil {
		return protocol.RuntimeInfo{}, false
	}

	version := strings.TrimSpace(string(out))
	// Cleanup common prefixes/suffixes
	version = strings.TrimPrefix(version, "v")
	version = strings.Split(version, "\n")[0] // First line only

	return protocol.RuntimeInfo{
		Name:    displayName,
		Version: version,
		Path:    path,
	}, true
}
