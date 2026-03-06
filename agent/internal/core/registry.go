package core

import (
	"fmt"
	"sync"
)

type Registry struct {
	modules map[string]ServiceModule
	mu      sync.RWMutex
}

func NewRegistry() *Registry {
	return &Registry{
		modules: make(map[string]ServiceModule),
	}
}

func (r *Registry) Register(module ServiceModule) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.modules[module.Name()] = module
}

func (r *Registry) Unregister(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.modules, name)
}

func (r *Registry) Get(name string) (ServiceModule, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	module, ok := r.modules[name]
	if !ok {
		return nil, fmt.Errorf("module %s not found", name)
	}
	return module, nil
}

func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.modules))
	for name := range r.modules {
		names = append(names, name)
	}
	return names
}
