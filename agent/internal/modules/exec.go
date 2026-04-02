package modules

import (
	"os/exec"
)

// Executor defines an interface for executing system commands.
// Use this to facilitate mocking in unit tests.
type Executor interface {
	Command(name string, arg ...string) Command
}

// Command mimics the os/exec.Cmd interface.
type Command interface {
	Run() error
	Output() ([]byte, error)
	CombinedOutput() ([]byte, error)
	SetEnv(env []string)
	SetStdin(r interface{}) // Simplified for common use cases
}

// DefaultExecutor implements Executor using os/exec.
type DefaultExecutor struct{}

func (e *DefaultExecutor) Command(name string, arg ...string) Command {
	return &defaultCmd{Cmd: exec.Command(name, arg...)}
}

type defaultCmd struct {
	*exec.Cmd
}

func (c *defaultCmd) SetEnv(env []string) {
	c.Cmd.Env = env
}

func (c *defaultCmd) SetStdin(r interface{}) {
	if reader, ok := r.(interface{ Read(p []byte) (n int, err error) }); ok {
		c.Cmd.Stdin = reader
	}
}

// Global default executor
var currentExecutor Executor = &DefaultExecutor{}

func SetExecutor(e Executor) {
	currentExecutor = e
}

func getExecutor() Executor {
	return currentExecutor
}
