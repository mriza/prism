package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"prism-server/internal/hub"
	"prism-server/internal/protocol"
	"sync"
	"time"
)

type DecisionItem struct {
	ID        int    `json:"id"`
	Origin    string `json:"origin"`
	Type      string `json:"type"`
	Scope     string `json:"scope"`
	Value     string `json:"value"`
	Duration  string `json:"duration"`
	Reason    string `json:"scenario"`
	AgentName string `json:"agent_name"`
	AgentID   string `json:"agent_id"`
}

func HandleGlobalBan(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		IP       string `json:"ip"`
		Duration string `json:"duration"`
		Reason   string `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.IP == "" {
		http.Error(w, "IP address is required", http.StatusBadRequest)
		return
	}

	if AgentHub == nil {
		http.Error(w, "Hub not initialized", http.StatusInternalServerError)
		return
	}

	agents := AgentHub.GetAgents()
	fireCount := 0
	for _, agent := range agents {
		cmdID := fmt.Sprintf("ban-%d", time.Now().UnixNano())
		cmd := protocol.Message{
			Type: protocol.MsgTypeCommand,
			Payload: protocol.CommandPayload{
				CommandID: cmdID,
				Action:    "crowdsec_add",
				Service:   "crowdsec",
				Options: map[string]interface{}{
					"ip":       req.IP,
					"duration": req.Duration,
					"reason":   req.Reason,
					"type":     "ban",
				},
			},
		}
		go agent.Send(cmd)
		fireCount++
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Ban command dispatched to %d agents", fireCount),
	})
}

func HandleGlobalUnban(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		IP string `json:"ip"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.IP == "" {
		http.Error(w, "IP address is required", http.StatusBadRequest)
		return
	}

	if AgentHub == nil {
		http.Error(w, "Hub not initialized", http.StatusInternalServerError)
		return
	}

	agents := AgentHub.GetAgents()
	fireCount := 0
	for _, agent := range agents {
		cmdID := fmt.Sprintf("unban-%d", time.Now().UnixNano())
		cmd := protocol.Message{
			Type: protocol.MsgTypeCommand,
			Payload: protocol.CommandPayload{
				CommandID: cmdID,
				Action:    "crowdsec_delete_by_ip",
				Service:   "crowdsec",
				Options: map[string]interface{}{
					"ip": req.IP,
				},
			},
		}
		go agent.Send(cmd)
		fireCount++
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Unban command dispatched to %d agents", fireCount),
	})
}

func HandleSecurityDecisions(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if AgentHub == nil {
		json.NewEncoder(w).Encode([]interface{}{})
		return
	}

	allHubAgents := AgentHub.GetAgents()
	var targetedAgents []*hub.AgentSession
	for _, agent := range allHubAgents {
		// Only poll if they have the crowdsec service running
		if svc, ok := agent.Services["crowdsec"]; ok && svc.Status == "running" {
			targetedAgents = append(targetedAgents, agent)
		}
	}

	if len(targetedAgents) == 0 {
		json.NewEncoder(w).Encode([]interface{}{})
		return
	}

	var mu sync.Mutex
	var allDecisions []DecisionItem
	var wg sync.WaitGroup

	for _, agent := range targetedAgents {
		wg.Add(1)
		go func(ag *hub.AgentSession) {
			defer wg.Done()

			cmdID := fmt.Sprintf("cslist-%d", time.Now().UnixNano())
			cmd := protocol.Message{
				Type: protocol.MsgTypeCommand,
				Payload: protocol.CommandPayload{
					CommandID: cmdID,
					Action:    "crowdsec_list",
					Service:   "crowdsec",
				},
			}

			respCh := make(chan *protocol.Message, 1)
			AgentHub.SetResponseChan(cmdID, respCh)
			defer AgentHub.DeleteResponseChan(cmdID)

			if err := ag.Send(cmd); err != nil {
				return
			}

			select {
			case resp := <-respCh:
				if respPayload, ok := resp.Payload.(map[string]interface{}); ok {
					if success, _ := respPayload["success"].(bool); success {
						if msg, _ := respPayload["message"].(string); msg != "" && msg != "[]" && msg != "null" {
							var decs []DecisionItem
							if err := json.Unmarshal([]byte(msg), &decs); err == nil {
								// Assign metadata
								for i := range decs {
									decs[i].AgentName = ag.ID
									decs[i].AgentID = ag.ID
								}
								mu.Lock()
								allDecisions = append(allDecisions, decs...)
								mu.Unlock()
							}
						}
					}
				}
			case <-time.After(5 * time.Second):
				return
			}
		}(agent)
	}

	wg.Wait()

	if allDecisions == nil {
		allDecisions = []DecisionItem{}
	}
	json.NewEncoder(w).Encode(allDecisions)
}
