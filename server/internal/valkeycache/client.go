package valkeycache

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/valkey-io/valkey-go"
)

// Client wraps Valkey client for caching
type Client struct {
	client valkey.Client
	prefix string
}

// Config holds Valkey configuration
type Config struct {
	Addr     string
	Password string
	DB       int
	Prefix   string
}

// DefaultConfig returns default Valkey configuration
func DefaultConfig() Config {
	return Config{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
		Prefix:   "prism:cache:",
	}
}

// NewClient creates a new Valkey client
func NewClient(ctx context.Context, cfg Config) (*Client, error) {
	client, err := valkey.NewClient(valkey.ClientOption{
		InitAddress:  []string{cfg.Addr},
		Password:     cfg.Password,
		SelectDB:     cfg.DB,
		DisableCache: false,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Valkey client: %w", err)
	}

	// Test connection
	if err := client.Do(ctx, client.B().Ping().Build()).Error(); err != nil {
		return nil, fmt.Errorf("failed to ping Valkey: %w", err)
	}

	log.Printf("Connected to Valkey at %s", cfg.Addr)

	return &Client{
		client: client,
		prefix: cfg.Prefix,
	}, nil
}

// Close closes the Valkey connection
func (c *Client) Close() {
	if c.client != nil {
		c.client.Close()
	}
}

// key returns the prefixed key
func (c *Client) key(k string) string {
	return c.prefix + k
}

// Set caches a value with TTL
func (c *Client) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	err = c.client.Do(ctx, c.client.B().Set().Key(c.key(key)).Value(string(data)).Ex(ttl).Build()).Error()
	return err
}

// Get retrieves a cached value
func (c *Client) Get(ctx context.Context, key string, dest interface{}) error {
	result, err := c.client.Do(ctx, c.client.B().Get().Key(c.key(key)).Build()).ToString()
	if err != nil {
		return err
	}

	return json.Unmarshal([]byte(result), dest)
}

// Delete removes a cached value
func (c *Client) Delete(ctx context.Context, key string) error {
	err := c.client.Do(ctx, c.client.B().Del().Key(c.key(key)).Build()).Error()
	return err
}

// Exists checks if a key exists
func (c *Client) Exists(ctx context.Context, key string) (bool, error) {
	result, err := c.client.Do(ctx, c.client.B().Exists().Key(c.key(key)).Build()).AsInt64()
	if err != nil {
		return false, err
	}
	return result > 0, nil
}

// Publish publishes a message to a channel
func (c *Client) Publish(ctx context.Context, channel string, message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	err = c.client.Do(ctx, c.client.B().Publish().Channel(channel).Message(string(data)).Build()).Error()
	return err
}

// Health checks Valkey connection
func (c *Client) Health(ctx context.Context) (map[string]interface{}, error) {
	result := make(map[string]interface{})

	// Ping test
	if err := c.client.Do(ctx, c.client.B().Ping().Build()).Error(); err != nil {
		result["status"] = "unhealthy"
		result["error"] = err.Error()
		return result, err
	}

	result["status"] = "healthy"

	// Get info
	info, err := c.client.Do(ctx, c.client.B().Info().Build()).ToString()
	if err == nil {
		result["info"] = info[:500] // First 500 chars
	}

	return result, nil
}

// Flush clears all cache
func (c *Client) Flush(ctx context.Context) error {
	err := c.client.Do(ctx, c.client.B().Flushdb().Build()).Error()
	return err
}

// GetRedisClient returns the underlying valkey.Client for advanced operations
func (c *Client) GetRedisClient() valkey.Client {
	return c.client
}
