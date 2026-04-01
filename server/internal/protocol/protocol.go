package protocol

// Message Types
const (
	MsgTypeRegister  = "register"
	MsgTypeWelcome   = "welcome"
	MsgTypeCommand   = "command"
	MsgTypeResponse  = "response"
	MsgTypeEvent     = "event"
	MsgTypeKeepAlive = "ping"
)

// Base Message
type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// Payloads

type ServiceInfo struct {
	Name    string             `json:"name"`
	Status  string             `json:"status"` // running, stopped, unknown, error
	Metrics map[string]float64 `json:"metrics,omitempty"`
}

type RegisterPayload struct {
	AgentID  string        `json:"agent_id"`
	Hostname string        `json:"hostname"`
	OSInfo   string        `json:"os_info"`
	Token    string        `json:"token"`
	Services []ServiceInfo `json:"services"` // List of managed services with their initial status
	Runtimes []RuntimeInfo `json:"runtimes"` // DETECTED RUNTIMES (Node, Python, Go, etc.)
}

type RuntimeInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Path    string `json:"path"`
}

type KeepAlivePayload struct {
	Services []ServiceInfo `json:"services"` // Periodic status updates
}

type WelcomePayload struct {
	AgentID           string `json:"agent_id"`
	HeartbeatInterval int    `json:"heartbeat_interval"` // in seconds
}

type CommandPayload struct {
	CommandID string                 `json:"command_id"`
	Action    string                 `json:"action"` // start, stop, status
	Service   string                 `json:"service"`
	Options   map[string]interface{} `json:"options,omitempty"`
}

type ResponsePayload struct {
	CommandID string      `json:"command_id"`
	Success   bool        `json:"success"`
	Message   string      `json:"message"` // Legacy
	Output    string      `json:"output"`  // Consistent with agent
	Error     string      `json:"error,omitempty"`
	Data      interface{} `json:"data,omitempty"`
}

type EventPayload struct {
	Type    string `json:"type"` // service_status_change
	Service string `json:"service"`
	Status  string `json:"status"`
	Message string `json:"message"`
}
