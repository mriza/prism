package main

import (
	"encoding/json"
	"fitz-agent/internal/core"
	"fmt"
)

// CommandHandlerFunc defines the signature for a command handler
type CommandHandlerFunc func(mod core.ServiceModule, payload map[string]interface{}) (string, error)

// CommandHandlers maps command actions to their handler functions
var CommandHandlers = map[string]CommandHandlerFunc{
	// --- Generic Service Control ---
	"start": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		return "", mod.Start()
	},
	"stop": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		return "", mod.Stop()
	},
	"restart": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		return "", mod.Restart()
	},
	"status": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		st, err := mod.Status()
		return string(st), err
	},
	"get_facts": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		facts, err := mod.GetFacts()
		if err != nil { return "", err }
		b, _ := json.Marshal(facts)
		return string(b), nil
	},

	// --- Database ---
	"db_list_dbs": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		if db, ok := mod.(core.DatabaseModule); ok {
			dbs, err := db.ListDatabases()
			if err != nil { return "", err }
			b, _ := json.Marshal(dbs)
			return string(b), nil
		}
		return "", fmt.Errorf("module does not support database operations")
	},
	"db_create_db": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if db, ok := mod.(core.DatabaseModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			name, _ := opts["name"].(string)
			return "", db.CreateDatabase(name)
		}
		return "", fmt.Errorf("module does not support database operations")
	},
	"db_list_users": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		if db, ok := mod.(core.DatabaseModule); ok {
			users, err := db.ListUsers()
			if err != nil { return "", err }
			b, _ := json.Marshal(users)
			return string(b), nil
		}
		return "", fmt.Errorf("module does not support database operations")
	},
	"db_create_user": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if db, ok := mod.(core.DatabaseModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			user, _ := opts["username"].(string)
			pass, _ := opts["password"].(string)
			return "", db.CreateUser(user, pass)
		}
		return "", fmt.Errorf("module does not support database operations")
	},

	// --- RabbitMQ ---
	"rmq_list_vhosts": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			vhosts, err := rmq.ListVHosts()
			if err != nil { return "", err }
			b, _ := json.Marshal(vhosts)
			return string(b), nil
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_create_vhost": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			name, _ := opts["name"].(string)
			return "", rmq.CreateVHost(name)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_list_users": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			users, err := rmq.ListUsers()
			if err != nil { return "", err }
			b, _ := json.Marshal(users)
			return string(b), nil
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_create_user": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			user, _ := opts["username"].(string)
			pass, _ := opts["password"].(string)
			tags, _ := opts["tags"].(string)
			return "", rmq.CreateUser(user, pass, tags)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_set_permissions": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			vhost, _ := opts["vhost"].(string)
			user, _ := opts["username"].(string)
			return "", rmq.SetPermissions(vhost, user, ".*", ".*", ".*")
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_create_binding": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			vhost, _ := opts["vhost"].(string)
			queue, _ := opts["queue"].(string)
			exchange, _ := opts["exchange"].(string)
			routingKey, _ := opts["routing_key"].(string)
			return "", rmq.CreateBinding(vhost, exchange, queue, routingKey)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},

	// --- Web Server ---
	"web_list_sites": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			sites, err := web.ListSites()
			if err != nil { return "", err }
			b, _ := json.Marshal(sites)
			return string(b), nil
		}
		return "", fmt.Errorf("not a web server module")
	},
	"web_create_site": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			name, _ := opts["name"].(string)
			content, _ := opts["content"].(string)
			return "", web.CreateSite(name, content)
		}
		return "", fmt.Errorf("not a web server module")
	},
	"web_delete_site": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			name, _ := opts["name"].(string)
			return "", web.DeleteSite(name)
		}
		return "", fmt.Errorf("not a web server module")
	},
	"web_enable_site": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			name, _ := opts["name"].(string)
			return "", web.EnableSite(name)
		}
		return "", fmt.Errorf("not a web server module")
	},
	"web_disable_site": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			name, _ := opts["name"].(string)
			return "", web.DisableSite(name)
		}
		return "", fmt.Errorf("not a web server module")
	},

	// --- Storage ---
	"storage_list_buckets": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			buckets, err := store.ListBuckets()
			if err != nil { return "", err }
			b, _ := json.Marshal(buckets)
			return string(b), nil
		}
		return "", fmt.Errorf("not a storage module")
	},
	"storage_create_bucket": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			name, _ := opts["name"].(string)
			return "", store.CreateBucket(name)
		}
		return "", fmt.Errorf("not a storage module")
	},
	"storage_delete_bucket": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			name, _ := opts["name"].(string)
			return "", store.DeleteBucket(name)
		}
		return "", fmt.Errorf("not a storage module")
	},
	"storage_list_users": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			users, err := store.ListUsers()
			if err != nil { return "", err }
			b, _ := json.Marshal(users)
			return string(b), nil
		}
		return "", fmt.Errorf("not a storage module")
	},
	"storage_create_user": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			accessKey, _ := opts["access_key"].(string)
			secretKey, _ := opts["secret_key"].(string)
			user, err := store.CreateUser(accessKey, secretKey)
			if err != nil { return "", err }
			b, _ := json.Marshal(user)
			return string(b), nil
		}
		return "", fmt.Errorf("not a storage module")
	},
	"storage_delete_user": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			accessKey, _ := opts["access_key"].(string)
			if accessKey == "" { accessKey, _ = opts["username"].(string) }
			return "", store.DeleteUser(accessKey)
		}
		return "", fmt.Errorf("not a storage module")
	},
	// --- Ansible ---
	"ansible_run_playbook": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if ansible, ok := mod.(core.AnsibleModule); ok {
			opts, _ := p["options"].(map[string]interface{})
			playbook, _ := opts["playbook"].(string)
			inventory, _ := opts["inventory"].(string)
			vars, _ := opts["extra_vars"].(string)
			return ansible.RunPlaybook(playbook, inventory, vars)
		}
		return "", fmt.Errorf("not an ansible module")
	},
}
