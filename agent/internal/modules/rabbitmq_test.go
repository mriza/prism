package modules

import (
	"testing"
)

func TestRabbitMQModule_ListVHosts(t *testing.T) {
	mock := &MockExecutor{
		ReturnOutput: []byte("/\ntest_vhost\n"),
	}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewRabbitMQModule()
	vhosts, err := module.ListVHosts()

	if err != nil {
		t.Fatalf("ListVHosts failed: %v", err)
	}

	if len(vhosts) != 2 {
		t.Fatalf("Expected 2 vhosts, got %d", len(vhosts))
	}

	if vhosts[0] != "/" || vhosts[1] != "test_vhost" {
		t.Errorf("Unexpected vhosts: %v", vhosts)
	}
}

func TestRabbitMQModule_CreateVHost(t *testing.T) {
	mock := &MockExecutor{}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewRabbitMQModule()
	err := module.CreateVHost("new_vhost")

	if err != nil {
		t.Fatalf("CreateVHost failed: %v", err)
	}

	if len(mock.Commands) != 1 {
		t.Fatalf("Expected 1 command, got %d", len(mock.Commands))
	}

	cmd := mock.Commands[0]
	if cmd.Name != "rabbitmqctl" || cmd.Args[0] != "add_vhost" || cmd.Args[1] != "new_vhost" {
		t.Errorf("Unexpected command: %v", cmd)
	}
}

func TestRabbitMQModule_CreateUser(t *testing.T) {
	mock := &MockExecutor{}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewRabbitMQModule()
	err := module.CreateUser("rmq_user", "Secret123!", "administrator", "test_vhost")

	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	// Should have 3 commands: add_user, set_user_tags, set_permissions
	if len(mock.Commands) != 3 {
		t.Fatalf("Expected 3 commands, got %d", len(mock.Commands))
	}

	foundAdd := false
	foundTags := false
	foundPerms := false

	for _, cmd := range mock.Commands {
		if cmd.Args[0] == "add_user" && cmd.Args[1] == "rmq_user" {
			foundAdd = true
		}
		if cmd.Args[0] == "set_user_tags" && cmd.Args[1] == "rmq_user" && cmd.Args[2] == "administrator" {
			foundTags = true
		}
		if cmd.Args[0] == "set_permissions" && cmd.Args[2] == "test_vhost" && cmd.Args[3] == "rmq_user" {
			foundPerms = true
		}
	}

	if !foundAdd || !foundTags || !foundPerms {
		t.Errorf("Missing commands: add=%v, tags=%v, perms=%v", foundAdd, foundTags, foundPerms)
	}
}

func TestRabbitMQModule_SyncBindings(t *testing.T) {
	mock := &MockExecutor{}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewRabbitMQModule()
	bindings := []map[string]interface{}{
		{
			"vhost":            "test_vhost",
			"sourceExchange":   "amq.topic",
			"destinationQueue": "test_queue",
			"routingKey":       "sensor.#",
		},
	}

	err := module.SyncBindings(bindings)
	if err != nil {
		t.Fatalf("SyncBindings failed: %v", err)
	}

	// Should have commands for: declare queue, declare exchange, bind_queue
	// wait, rabbitmqadmin is used for declare, rabbitmqctl for bind_queue
	
	foundQueue := false
	foundExchange := false
	foundBind := false

	for _, cmd := range mock.Commands {
		if cmd.Name == "rabbitmqadmin" && len(cmd.Args) >= 2 && cmd.Args[0] == "declare" && cmd.Args[1] == "queue" {
			foundQueue = true
		}
		if cmd.Name == "rabbitmqadmin" && len(cmd.Args) >= 2 && cmd.Args[0] == "declare" && cmd.Args[1] == "exchange" {
			foundExchange = true
		}
		if cmd.Name == "rabbitmqctl" && cmd.Args[0] == "bind_queue" && cmd.Args[1] == "test_queue" {
			foundBind = true
		}
	}

	if !foundQueue || !foundExchange || !foundBind {
		t.Errorf("Missing sync commands: queue=%v, exchange=%v, bind=%v", foundQueue, foundExchange, foundBind)
	}
}
