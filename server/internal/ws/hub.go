package ws

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

var ctx = context.Background()

// Client represents a connected WebSocket client (frontend)
type Client struct {
	ID        string
	Conn      *websocket.Conn
	Send      chan []byte
	Subscriptions map[string]bool
	mu        sync.RWMutex
}

// Hub manages WebSocket clients
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	valkeyClient interface{} // Can be *redis.Client or nil
	mu         sync.RWMutex
}

// WebSocket message types
type WSMessage struct {
	Type      string      `json:"type"`
	Channel   string      `json:"channel,omitempty"`
	Payload   interface{} `json:"payload,omitempty"`
	Timestamp int64       `json:"timestamp"`
}

// NewHub creates a new WebSocket hub
func NewHub(valkeyClient interface{}) *Hub {
	return &Hub{
		clients:      make(map[*Client]bool),
		broadcast:    make(chan []byte, 256),
		register:     make(chan *Client),
		unregister:   make(chan *Client),
		valkeyClient: valkeyClient,
	}
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket client connected: %s (total: %d)", client.ID, len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
			}
			h.mu.Unlock()
			log.Printf("WebSocket client disconnected: %s (total: %d)", client.ID, len(h.clients))

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
					// Client buffer full, disconnect
					close(client.Send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastToChannel sends message to clients subscribed to a channel
func (h *Hub) BroadcastToChannel(channel string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		client.mu.RLock()
		if client.Subscriptions[channel] {
			select {
			case client.Send <- message:
			default:
				// Buffer full
			}
		}
		client.mu.RUnlock()
	}
}

// Broadcast sends message to all connected clients
func (h *Hub) Broadcast(message []byte) {
	select {
	case h.broadcast <- message:
	default:
		// Broadcast buffer full
	}
}

// SubscribeToValkey subscribes to Valkey Pub/Sub channels and forwards to WebSocket
func (h *Hub) SubscribeToValkey(channels ...string) {
	// Type assert to redis.Client
	redisClient, ok := h.valkeyClient.(*redis.Client)
	if !ok || redisClient == nil {
		log.Println("Valkey/Redis client not initialized, skipping Pub/Sub subscription")
		return
	}

	pubsub := redisClient.Subscribe(ctx, channels...)
	
	// Subscribe to confirmation
	_, err := pubsub.Receive(ctx)
	if err != nil {
		log.Printf("Failed to subscribe to Valkey channels %v: %v", channels, err)
		return
	}

	log.Printf("Subscribed to Valkey channels: %v", channels)

	go func() {
		ch := pubsub.Channel()
		for msg := range ch {
			// Forward Valkey message to WebSocket clients
			h.BroadcastToChannel(msg.Channel, []byte(msg.Payload))
		}
	}()
}

// GetClientCount returns the number of connected clients
func (h *Hub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// HandleClient handles WebSocket client connection
func (h *Hub) HandleClient(conn *websocket.Conn, clientID string) {
	client := &Client{
		ID:            clientID,
		Conn:          conn,
		Send:          make(chan []byte, 256),
		Subscriptions: make(map[string]bool),
	}

	h.register <- client

	// Send welcome message
	welcome := WSMessage{
		Type:      "connected",
		Payload:   map[string]string{"client_id": clientID},
		Timestamp: time.Now().UnixNano(),
	}
	conn.WriteJSON(welcome)

	// Ensure cleanup on exit
	defer func() {
		h.unregister <- client
		conn.Close()
	}()

	// Read messages from client
	go func() {
		defer func() {
			h.unregister <- client
			conn.Close()
		}()

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket error: %v", err)
				}
				break
			}

			h.handleMessage(client, message)
		}
	}()

	// Write messages to client
	for {
		select {
		case message, ok := <-client.Send:
			if !ok {
				// Channel closed
				conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Failed to send message to client %s: %v", clientID, err)
				return
			}
		}
	}
}

// handleMessage processes incoming WebSocket messages
func (h *Hub) handleMessage(client *Client, message []byte) {
	var msg WSMessage
	if err := json.Unmarshal(message, &msg); err != nil {
		log.Printf("Failed to parse message: %v", err)
		return
	}

	switch msg.Type {
	case "subscribe":
		channel := msg.Channel
		if channel != "" {
			client.mu.Lock()
			client.Subscriptions[channel] = true
			client.mu.Unlock()
			log.Printf("Client %s subscribed to channel: %s", client.ID, channel)
			
			// Send confirmation
			confirm := WSMessage{
				Type:      "subscribed",
				Channel:   channel,
				Timestamp: time.Now().UnixNano(),
			}
			client.Send <- mustMarshal(confirm)
		}

	case "unsubscribe":
		channel := msg.Channel
		if channel != "" {
			client.mu.Lock()
			delete(client.Subscriptions, channel)
			client.mu.Unlock()
			log.Printf("Client %s unsubscribed from channel: %s", client.ID, channel)
		}

	case "ping":
		pong := WSMessage{
			Type:      "pong",
			Timestamp: time.Now().UnixNano(),
		}
		client.Send <- mustMarshal(pong)
	}
}

func mustMarshal(v interface{}) []byte {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("Failed to marshal: %v", err)
		return nil
	}
	return data
}
