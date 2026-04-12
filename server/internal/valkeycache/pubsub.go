package valkeycache

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/valkey-io/valkey-go"
)

// PubSubClient wraps Redis Pub/Sub functionality
type PubSubClient struct {
	client valkey.Client
}

// Event represents a real-time event published via Pub/Sub
type Event struct {
	Type      string                 `json:"type"`
	Channel   string                 `json:"channel"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

// NewPubSubClient creates a new Pub/Sub client
func NewPubSubClient(client valkey.Client) *PubSubClient {
	return &PubSubClient{client: client}
}

// PublishEvent publishes an event to a channel
func (p *PubSubClient) PublishEvent(ctx context.Context, channel string, eventType string, data map[string]interface{}) error {
	event := Event{
		Type:      eventType,
		Channel:   channel,
		Timestamp: time.Now().UTC(),
		Data:      data,
	}

	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}

	err = p.client.Do(ctx, p.client.B().Publish().Channel(channel).Message(string(payload)).Build()).Error()
	return err
}

// PublishServerEvent publishes server-specific events to events:server:{id}
func (p *PubSubClient) PublishServerEvent(ctx context.Context, serverID string, eventType string, data map[string]interface{}) error {
	channel := "events:server:" + serverID
	return p.PublishEvent(ctx, channel, eventType, data)
}

// PublishServiceEvent publishes service-specific events to events:service:{id}
func (p *PubSubClient) PublishServiceEvent(ctx context.Context, serviceID string, eventType string, data map[string]interface{}) error {
	channel := "events:service:" + serviceID
	return p.PublishEvent(ctx, channel, eventType, data)
}

// PublishAlert publishes alert events to events:alerts
func (p *PubSubClient) PublishAlert(ctx context.Context, alertType string, data map[string]interface{}) error {
	channel := "events:alerts"
	return p.PublishEvent(ctx, channel, alertType, data)
}

// PublishCommandEvent publishes command status events to events:commands:{id}
func (p *PubSubClient) PublishCommandEvent(ctx context.Context, commandID string, eventType string, data map[string]interface{}) error {
	channel := "events:commands:" + commandID
	return p.PublishEvent(ctx, channel, eventType, data)
}

// Subscribe subscribes to one or more channels and calls handler for each message
func (p *PubSubClient) Subscribe(ctx context.Context, handler func(channel string, event *Event), channels ...string) error {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("PubSub subscriber goroutine panicked: %v", r)
			}
		}()

		for {
			select {
			case <-ctx.Done():
				log.Printf("PubSub subscription cancelled for channels: %v", channels)
				return
			default:
				// Use valkey-go's blocking subscribe
				for _, channel := range channels {
					result := p.client.Do(ctx, p.client.B().Subscribe().Channel(channel).Build())
					if result.Error() != nil {
						if ctx.Err() != nil {
							return
						}
						log.Printf("Subscribe error on %s: %v", channel, result.Error())
						time.Sleep(1 * time.Second)
						continue
					}
				}
			}
		}
	}()
	return nil
}

// PublishAgentConnect publishes agent connection event
func (p *PubSubClient) PublishAgentConnect(ctx context.Context, serverID string, hostname string) error {
	return p.PublishServerEvent(ctx, serverID, "agent.connect", map[string]interface{}{
		"server_id": serverID,
		"hostname":  hostname,
		"status":    "connected",
	})
}

// PublishAgentDisconnect publishes agent disconnection event
func (p *PubSubClient) PublishAgentDisconnect(ctx context.Context, serverID string, hostname string) error {
	return p.PublishServerEvent(ctx, serverID, "agent.disconnect", map[string]interface{}{
		"server_id": serverID,
		"hostname":  hostname,
		"status":    "disconnected",
	})
}

// PublishServerStatusChange publishes server status change event
func (p *PubSubClient) PublishServerStatusChange(ctx context.Context, serverID string, oldStatus, newStatus string) error {
	return p.PublishServerEvent(ctx, serverID, "server.status_change", map[string]interface{}{
		"server_id":  serverID,
		"old_status": oldStatus,
		"new_status": newStatus,
	})
}

// PublishServiceStatusChange publishes service status change event
func (p *PubSubClient) PublishServiceStatusChange(ctx context.Context, serviceID string, serverID string, oldStatus, newStatus string) error {
	data := map[string]interface{}{
		"service_id": serviceID,
		"server_id":  serverID,
		"old_status": oldStatus,
		"new_status": newStatus,
	}

	// Publish to both service and server channels
	if err := p.PublishServiceEvent(ctx, serviceID, "service.status_change", data); err != nil {
		return err
	}

	return p.PublishServerEvent(ctx, serverID, "service.status_change", data)
}

// PublishTelemetryReceived publishes telemetry received event
func (p *PubSubClient) PublishTelemetryReceived(ctx context.Context, serverID string, serviceID string, metrics map[string]interface{}) error {
	data := map[string]interface{}{
		"server_id":  serverID,
		"service_id": serviceID,
		"metrics":    metrics,
	}

	// Publish to server channel
	return p.PublishServerEvent(ctx, serverID, "telemetry.received", data)
}

// PublishAlertThreshold publishes threshold breach alert
func (p *PubSubClient) PublishAlertThreshold(ctx context.Context, serverID string, serviceID string, metricName string, threshold float64, currentValue float64) error {
	return p.PublishAlert(ctx, "threshold.breach", map[string]interface{}{
		"server_id":     serverID,
		"service_id":    serviceID,
		"metric_name":   metricName,
		"threshold":     threshold,
		"current_value": currentValue,
		"severity":      "warning",
		"alert_type":    "threshold",
	})
}

// PublishAlertAgentUnreachable publishes agent unreachable alert
func (p *PubSubClient) PublishAlertAgentUnreachable(ctx context.Context, serverID string, hostname string, lastHeartbeat string) error {
	return p.PublishAlert(ctx, "agent.unreachable", map[string]interface{}{
		"server_id":      serverID,
		"hostname":       hostname,
		"last_heartbeat": lastHeartbeat,
		"severity":       "critical",
		"alert_type":     "connectivity",
	})
}

// PublishAlertCertificateExpiring publishes certificate expiring alert
func (p *PubSubClient) PublishAlertCertificateExpiring(ctx context.Context, serverID string, daysUntilExpiry int) error {
	return p.PublishAlert(ctx, "certificate.expiring", map[string]interface{}{
		"server_id":         serverID,
		"days_until_expiry": daysUntilExpiry,
		"severity":          "warning",
		"alert_type":        "security",
	})
}

// PublishCommandDispatched publishes command dispatched event
func (p *PubSubClient) PublishCommandDispatched(ctx context.Context, commandID string, serverID string, serviceID string, commandType string) error {
	return p.PublishCommandEvent(ctx, commandID, "command.dispatched", map[string]interface{}{
		"command_id":   commandID,
		"server_id":    serverID,
		"service_id":   serviceID,
		"command_type": commandType,
		"status":       "sent",
	})
}

// PublishCommandExecuted publishes command executed event
func (p *PubSubClient) PublishCommandExecuted(ctx context.Context, commandID string, result map[string]interface{}) error {
	data := map[string]interface{}{
		"command_id": commandID,
		"status":     "executed",
		"result":     result,
	}
	return p.PublishCommandEvent(ctx, commandID, "command.executed", data)
}

// PublishCommandFailed publishes command failed event
func (p *PubSubClient) PublishCommandFailed(ctx context.Context, commandID string, errMsg string) error {
	return p.PublishCommandEvent(ctx, commandID, "command.failed", map[string]interface{}{
		"command_id": commandID,
		"status":     "failed",
		"error":      errMsg,
	})
}

// PublishAccountCreated publishes account creation event
func (p *PubSubClient) PublishAccountCreated(ctx context.Context, accountID string, serverID string, serviceID string, username string) error {
	data := map[string]interface{}{
		"account_id": accountID,
		"server_id":  serverID,
		"service_id": serviceID,
		"username":   username,
		"action":     "created",
	}

	// Publish to both server and service channels
	if err := p.PublishServerEvent(ctx, serverID, "account.created", data); err != nil {
		return err
	}

	return p.PublishServiceEvent(ctx, serviceID, "account.created", data)
}

// PublishAccountDeleted publishes account deletion event
func (p *PubSubClient) PublishAccountDeleted(ctx context.Context, accountID string, serverID string, serviceID string, username string) error {
	data := map[string]interface{}{
		"account_id": accountID,
		"server_id":  serverID,
		"service_id": serviceID,
		"username":   username,
		"action":     "deleted",
	}

	// Publish to both server and service channels
	if err := p.PublishServerEvent(ctx, serverID, "account.deleted", data); err != nil {
		return err
	}

	return p.PublishServiceEvent(ctx, serviceID, "account.deleted", data)
}
