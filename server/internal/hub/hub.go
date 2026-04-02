package hub

import (
	"prism-server/internal/protocol"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type AgentSession struct {
	ID       string
	Conn     *websocket.Conn
	Services map[string]protocol.ServiceInfo
	LastSeen time.Time
	mu       sync.Mutex // Lock for writing to Conn
}

func (s *AgentSession) Send(msg interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.Conn.WriteJSON(msg)
}

type Hub struct {
	Agents           map[string]*AgentSession
	PendingResponses map[string]chan *protocol.Message
	mu               sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		Agents:           make(map[string]*AgentSession),
		PendingResponses: make(map[string]chan *protocol.Message),
	}
}

func (h *Hub) GetResponseChan(cmdID string) (chan *protocol.Message, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	ch, ok := h.PendingResponses[cmdID]
	return ch, ok
}

func (h *Hub) SetResponseChan(cmdID string, ch chan *protocol.Message) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.PendingResponses[cmdID] = ch
}

func (h *Hub) DeleteResponseChan(cmdID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.PendingResponses, cmdID)
}

func (h *Hub) RegisterAgent(id string, session *AgentSession) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.Agents[id] = session
}

func (h *Hub) UnregisterAgent(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.Agents, id)
}

func (h *Hub) GetAgent(id string) (*AgentSession, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	ag, ok := h.Agents[id]
	return ag, ok
}

func (h *Hub) GetAgents() map[string]*AgentSession {
	h.mu.RLock()
	defer h.mu.RUnlock()
	// Return a copy to avoid race conditions
	agents := make(map[string]*AgentSession)
	for k, v := range h.Agents {
		agents[k] = v
	}
	return agents
}
