package ws

import (
	"sync"
	"testing"
	"time"
)

func TestHubConcurrency(t *testing.T) {
	hub := NewHub(nil)
	go hub.Run()

	// Test concurrent client registration
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			client := &Client{
				ID:            string(rune(id)),
				Send:          make(chan []byte, 256),
				Subscriptions: make(map[string]bool),
			}
			hub.register <- client
			time.Sleep(10 * time.Millisecond)
		}(i)
	}

	wg.Wait()

	// Verify all clients registered
	hub.mu.RLock()
	count := len(hub.clients)
	hub.mu.RUnlock()

	if count != 10 {
		t.Errorf("Expected 10 clients, got %d", count)
	}
}

func TestHubBroadcastConcurrency(t *testing.T) {
	hub := NewHub(nil)
	go hub.Run()

	// Register test clients
	clients := make([]*Client, 5)
	for i := 0; i < 5; i++ {
		client := &Client{
			ID:            string(rune(i)),
			Send:          make(chan []byte, 256),
			Subscriptions: map[string]bool{"agents": true},
		}
		hub.register <- client
		clients[i] = client
	}

	time.Sleep(100 * time.Millisecond)

	// Test concurrent broadcasts
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			message := []byte(`{"type":"test","id":` + string(rune(id)) + `}`)
			hub.BroadcastToChannel("agents", message)
		}(i)
	}

	wg.Wait()

	// Give time for messages to be processed
	time.Sleep(100 * time.Millisecond)

	// Verify all clients received messages
	for i, client := range clients {
		messageCount := 0
		drainChan := func() {
			for {
				select {
				case <-client.Send:
					messageCount++
				default:
					return
				}
			}
		}
		drainChan()
		
		if messageCount != 10 {
			t.Errorf("Client %d expected 10 messages, got %d", i, messageCount)
		}
	}
}

func TestHubChannelSubscription(t *testing.T) {
	hub := NewHub(nil)
	go hub.Run()

	// Register client with subscription
	client := &Client{
		ID:            "test-client",
		Send:          make(chan []byte, 256),
		Subscriptions: map[string]bool{"agents": true, "events": true},
	}
	hub.register <- client

	time.Sleep(100 * time.Millisecond)

	// Broadcast to specific channel
	hub.BroadcastToChannel("agents", []byte(`{"type":"agent_update"}`))

	// Verify client received message
	select {
	case msg := <-client.Send:
		if string(msg) != `{"type":"agent_update"}` {
			t.Errorf("Unexpected message: %s", msg)
		}
	case <-time.After(1 * time.Second):
		t.Error("Timeout waiting for message")
	}

	// Broadcast to different channel
	hub.BroadcastToChannel("events", []byte(`{"type":"event_update"}`))

	// Verify client received message
	select {
	case msg := <-client.Send:
		if string(msg) != `{"type":"event_update"}` {
			t.Errorf("Unexpected message: %s", msg)
		}
	case <-time.After(1 * time.Second):
		t.Error("Timeout waiting for message")
	}
}

func TestHubClientUnregister(t *testing.T) {
	hub := NewHub(nil)
	go hub.Run()

	// Register client
	client := &Client{
		ID:            "test-client",
		Send:          make(chan []byte, 256),
		Subscriptions: make(map[string]bool),
	}
	hub.register <- client

	time.Sleep(100 * time.Millisecond)

	// Verify client registered
	hub.mu.RLock()
	_, exists := hub.clients[client]
	hub.mu.RUnlock()

	if !exists {
		t.Error("Client not registered")
	}

	// Unregister client
	hub.unregister <- client

	time.Sleep(100 * time.Millisecond)

	// Verify client unregistered
	hub.mu.RLock()
	_, exists = hub.clients[client]
	hub.mu.RUnlock()

	if exists {
		t.Error("Client still registered after unregister")
	}
}

func TestHubGetClientCount(t *testing.T) {
	hub := NewHub(nil)
	go hub.Run()

	// Register multiple clients
	for i := 0; i < 5; i++ {
		client := &Client{
			ID:            string(rune(i)),
			Send:          make(chan []byte, 256),
			Subscriptions: make(map[string]bool),
		}
		hub.register <- client
	}

	time.Sleep(100 * time.Millisecond)

	// Verify client count
	count := hub.GetClientCount()
	if count != 5 {
		t.Errorf("Expected 5 clients, got %d", count)
	}
}

func TestHubSendMessage(t *testing.T) {
	hub := NewHub(nil)
	go hub.Run()

	// Register client
	client := &Client{
		ID:            "test-client",
		Send:          make(chan []byte, 256),
		Subscriptions: make(map[string]bool),
	}
	hub.register <- client

	time.Sleep(100 * time.Millisecond)

	// Send message to client
	message := []byte(`{"type":"test"}`)
	select {
	case client.Send <- message:
		// Message sent successfully
	case <-time.After(1 * time.Second):
		t.Error("Timeout sending message to client")
	}

	// Verify message received
	select {
	case msg := <-client.Send:
		if string(msg) != `{"type":"test"}` {
			t.Errorf("Unexpected message: %s", msg)
		}
	case <-time.After(1 * time.Second):
		t.Error("Timeout waiting for message")
	}
}
