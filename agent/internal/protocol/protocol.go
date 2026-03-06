package protocol

// Message Types
const (
	MsgTypeRegister    = "register"
	MsgTypeWelcome     = "welcome"
	MsgTypeCommand     = "command"
	MsgTypeResponse    = "response"
	MsgTypeEvent       = "event"
	MsgTypeKeepAlive   = "ping"
)

// Base Message
type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// Payloads

type RegisterPayload struct {
	Hostname string   `json:"hostname"`
	Token    string   `json:"token"`
	Services []string `json:"services"` // List of managed services
}

type WelcomePayload struct {
	AgentID string `json:"agent_id"`
}

type CommandPayload struct {
	CommandID string                 `json:"command_id"`
	Action    string                 `json:"action"` // start, stop, status
	Service   string                 `json:"service"`
	Options   map[string]interface{} `json:"options,omitempty"`
}

type ResponsePayload struct {
	CommandID string `json:"command_id"`
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	Data      interface{} `json:"data,omitempty"`
}

type EventPayload struct {
	Type    string      `json:"type"` // service_status_change
	Service string      `json:"service"`
	Status  string      `json:"status"`
}
