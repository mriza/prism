package main

import (
	"fmt"
	"os"

	"github.com/pelletier/go-toml/v2"
)

type Config struct {
	Hub HubConfig `toml:"hub"`
}

type HubConfig struct {
	URL   string `toml:"url"`
	Token string `toml:"token"`
}

func main() {
	data, _ := os.ReadFile("prism-agent.conf")
	var cfg Config
	err := toml.Unmarshal(data, &cfg)
	fmt.Printf("err: %v\nurl: '%s'\ntoken: '%s'\n", err, cfg.Hub.URL, cfg.Hub.Token)
}
