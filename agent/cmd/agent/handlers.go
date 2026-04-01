package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"prism-agent/internal/config"
	"prism-agent/internal/core"
	"prism-agent/internal/modules"
)

// CommandContext provides access to agent level resources
type CommandContext struct {
	Registry   *core.Registry
	Config     *config.Config
	ConfigPath string
}

// CommandHandlerFunc defines the signature for a command handler
type CommandHandlerFunc func(mod core.ServiceModule, ctx *CommandContext, payload map[string]interface{}) (string, error)

// CommandHandlers maps command actions to their handler functions

// Helper functions for safe payload extraction
func getStringOpt(p map[string]interface{}, key string) string {
	if p == nil {
		return ""
	}
	optsRaw, ok := p["options"]
	if !ok || optsRaw == nil {
		return ""
	}
	opts, ok := optsRaw.(map[string]interface{})
	if !ok || opts == nil {
		return ""
	}
	val, ok := opts[key].(string)
	if !ok {
		return ""
	}
	return val
}

func getFloatOpt(p map[string]interface{}, key string) float64 {
	if p == nil {
		return 0
	}
	optsRaw, ok := p["options"]
	if !ok || optsRaw == nil {
		return 0
	}
	opts, ok := optsRaw.(map[string]interface{})
	if !ok || opts == nil {
		return 0
	}
	val, ok := opts[key].(float64)
	if !ok {
		return 0
	}
	return val
}

func getIntOpt(p map[string]interface{}, key string) int {
	if p == nil {
		return 0
	}
	optsRaw, ok := p["options"]
	if !ok || optsRaw == nil {
		return 0
	}
	opts, ok := optsRaw.(map[string]interface{})
	if !ok || opts == nil {
		return 0
	}
	val, ok := opts[key].(float64)
	if !ok {
		return 0
	}
	return int(val)
}

func getBoolOpt(p map[string]interface{}, key string) bool {
	if p == nil {
		return false
	}
	optsRaw, ok := p["options"]
	if !ok || optsRaw == nil {
		return false
	}
	opts, ok := optsRaw.(map[string]interface{})
	if !ok || opts == nil {
		return false
	}
	val, ok := opts[key].(bool)
	if !ok {
		return false
	}
	return val
}

func getInterfaceSliceOpt(p map[string]interface{}, key string) []map[string]interface{} {
	if p == nil {
		return nil
	}
	optsRaw, ok := p["options"]
	if !ok || optsRaw == nil {
		return nil
	}
	opts, ok := optsRaw.(map[string]interface{})
	if !ok || opts == nil {
		return nil
	}

	rawList, ok := opts[key].([]interface{})
	if !ok {
		return nil
	}

	result := make([]map[string]interface{}, 0, len(rawList))
	for _, item := range rawList {
		if m, ok := item.(map[string]interface{}); ok {
			result = append(result, m)
		}
	}
	return result
}

func injectCredentials(mod core.ServiceModule, p map[string]interface{}) {
	if aware, ok := mod.(core.ManagementCredentialAware); ok {
		optsRaw, ok := p["options"]
		if !ok || optsRaw == nil {
			return
		}
		opts, ok := optsRaw.(map[string]interface{})
		if !ok || opts == nil {
			return
		}
		credsRaw, ok := opts["management_credentials"]
		if !ok {
			return
		}
		if credsMap, ok := credsRaw.(map[string]interface{}); ok {
			creds := make(map[string]string)
			for k, v := range credsMap {
				creds[k] = fmt.Sprint(v)
			}
			aware.SetManagementCredentials(creds)
		}
	}
}

var CommandHandlers = map[string]CommandHandlerFunc{
	// --- Generic Service Control ---
	"start": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		return "", mod.Start()
	},
	"stop": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		return "", mod.Stop()
	},
	"restart": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		return "", mod.Restart()
	},
	"status": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		st, err := mod.Status()
		return string(st), err
	},
	"get_facts": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		facts, err := mod.GetFacts()
		if err != nil {
			return "", err
		}
		b, _ := json.Marshal(facts)
		return string(b), nil
	},
	"verify_credential": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		injectCredentials(mod, p)
		if db, ok := mod.(core.DatabaseModule); ok {
			_, err := db.ListDatabases()
			if err != nil {
				return "", fmt.Errorf("credential verification failed: %w", err)
			}
			return "Verification successful", nil
		}
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			_, err := rmq.ListUsers()
			if err != nil {
				return "", fmt.Errorf("credential verification failed: %w", err)
			}
			return "Verification successful", nil
		}
		if web, ok := mod.(core.WebServerModule); ok {
			_, err := web.ListSites()
			if err != nil {
				return "", fmt.Errorf("credential verification failed: %w", err)
			}
			return "Verification successful", nil
		}
		if st, ok := mod.(core.StorageModule); ok {
			_, err := st.ListBuckets()
			if err != nil {
				return "", fmt.Errorf("credential verification failed: %w", err)
			}
			return "Verification successful", nil
		}

		// Fallback for simple services
		_, err := mod.GetFacts()
		if err != nil {
			return "", fmt.Errorf("credential verification failed: %w", err)
		}
		return "Verification successful (basic check)", nil
	},

	// --- Database ---
	"db_list_dbs": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		injectCredentials(mod, p)
		if db, ok := mod.(core.DatabaseModule); ok {
			dbs, err := db.ListDatabases()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(dbs)
			return string(b), nil
		}
		return "", fmt.Errorf("module does not support database operations")
	},
	"db_create_db": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		injectCredentials(mod, p)
		name := getStringOpt(p, "name")
		if db, ok := mod.(core.DatabaseModule); ok {
			return "", db.CreateDatabase(name)
		}
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			return "", rmq.CreateVHost(name)
		}
		return "", fmt.Errorf("module does not support database/vhost creation")
	},
	"db_list_users": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		injectCredentials(mod, p)
		if db, ok := mod.(core.DatabaseModule); ok {
			users, err := db.ListUsers()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(users)
			return string(b), nil
		}
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			users, err := rmq.ListUsers()
			if err != nil {
				return "", err
			}
			// Convert to simple string list for parity with Generic DB
			var names []string
			for _, u := range users {
				names = append(names, u.Name)
			}
			b, _ := json.Marshal(names)
			return string(b), nil
		}
		return "", fmt.Errorf("module does not support user listing")
	},
	"db_create_user": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		injectCredentials(mod, p)
		user := getStringOpt(p, "username")
		pass := getStringOpt(p, "password")
		role := getStringOpt(p, "role")
		target := getStringOpt(p, "target")
		
		if db, ok := mod.(core.DatabaseModule); ok {
			return "", db.CreateUser(user, pass, role, target)
		}
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			if target == "" {
				target = "/" // Default vhost
			}
			return "", rmq.CreateUser(user, pass, role, target)
		}
		return "", fmt.Errorf("module does not support user creation")
	},
	"db_update_privileges": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		injectCredentials(mod, p)
		user := getStringOpt(p, "username")
		role := getStringOpt(p, "role")
		target := getStringOpt(p, "target")

		if db, ok := mod.(core.DatabaseModule); ok {
			return "", db.UpdatePrivileges(user, role, target)
		}
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			if target == "" {
				target = "/"
			}
			return "", rmq.SetPermissions(target, user, ".*", ".*", ".*")
		}
		return "", fmt.Errorf("module does not support privilege updates")
	},
	"db_create_binding": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			vhost := getStringOpt(p, "vhost")
			queue := getStringOpt(p, "destinationQueue") // Changed to match server names
			exchange := getStringOpt(p, "sourceExchange")
			routingKey := getStringOpt(p, "routingKey")
			return "", rmq.CreateBinding(vhost, exchange, queue, routingKey)
		}
		return "", fmt.Errorf("module does not support binding operations")
	},
	"db_sync": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			bindings := getInterfaceSliceOpt(p, "bindings")
			return "", rmq.SyncBindings(bindings)
		}
		return "", fmt.Errorf("module does not support sync operations")
	},

	// --- RabbitMQ ---
	"rmq_list_vhosts": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			vhosts, err := rmq.ListVHosts()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(vhosts)
			return string(b), nil
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_create_vhost": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			name := getStringOpt(p, "name")
			return "", rmq.CreateVHost(name)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_delete_vhost": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			name := getStringOpt(p, "name")
			return "", rmq.DeleteVHost(name)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_list_users": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			users, err := rmq.ListUsers()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(users)
			return string(b), nil
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_create_user": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			user := getStringOpt(p, "username")
			pass := getStringOpt(p, "password")
			role := getStringOpt(p, "role")
			target := getStringOpt(p, "vhost")
			return "", rmq.CreateUser(user, pass, role, target)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_set_permissions": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			vhost := getStringOpt(p, "vhost")
			user := getStringOpt(p, "username")
			return "", rmq.SetPermissions(vhost, user, ".*", ".*", ".*")
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_create_binding": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			vhost := getStringOpt(p, "vhost")
			queue := getStringOpt(p, "queue")
			exchange := getStringOpt(p, "exchange")
			routingKey := getStringOpt(p, "routing_key")
			return "", rmq.CreateBinding(vhost, exchange, queue, routingKey)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rabbitmq_sync": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			bindings := getInterfaceSliceOpt(p, "bindings")
			return "", rmq.SyncBindings(bindings)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rabbitmq_create_exchange": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			vhost := getStringOpt(p, "vhost")
			name := getStringOpt(p, "name")
			kind := getStringOpt(p, "type")
			if kind == "" {
				kind = "topic"
			}
			return "", rmq.DeclareExchange(vhost, name, kind)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rabbitmq_create_queue": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			vhost := getStringOpt(p, "vhost")
			name := getStringOpt(p, "name")
			return "", rmq.DeclareQueue(vhost, name)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_delete_user": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			user := getStringOpt(p, "username")
			return "", rmq.DeleteUser(user)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_list_exchanges": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			vhost := getStringOpt(p, "vhost")
			if vhost == "" {
				vhost = "/"
			}
			exchanges, err := rmq.ListExchanges(vhost)
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(exchanges)
			return string(b), nil
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_list_queues": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			vhost := getStringOpt(p, "vhost")
			if vhost == "" {
				vhost = "/"
			}
			queues, err := rmq.ListQueues(vhost)
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(queues)
			return string(b), nil
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},

	// --- Web Server ---
	"web_list_sites": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			sites, err := web.ListSites()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(sites)
			return string(b), nil
		}
		return "", fmt.Errorf("not a web server module")
	},
	"web_create_site": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			name := getStringOpt(p, "name")
			content := getStringOpt(p, "content")
			return "", web.CreateSite(name, content)
		}
		return "", fmt.Errorf("not a web server module")
	},
	"web_delete_site": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			name := getStringOpt(p, "name")
			return "", web.DeleteSite(name)
		}
		return "", fmt.Errorf("not a web server module")
	},
	"web_enable_site": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			name := getStringOpt(p, "name")
			return "", web.EnableSite(name)
		}
		return "", fmt.Errorf("not a web server module")
	},
	"web_disable_site": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			name := getStringOpt(p, "name")
			return "", web.DisableSite(name)
		}
		return "", fmt.Errorf("not a web server module")
	},

	// --- Storage ---
	"storage_list_buckets": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			buckets, err := store.ListBuckets()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(buckets)
			return string(b), nil
		}
		return "", fmt.Errorf("not a storage module")
	},
	"storage_create_bucket": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			name := getStringOpt(p, "name")
			return "", store.CreateBucket(name)
		}
		return "", fmt.Errorf("not a storage module")
	},
	"storage_delete_bucket": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			name := getStringOpt(p, "name")
			return "", store.DeleteBucket(name)
		}
		return "", fmt.Errorf("not a storage module")
	},
	"storage_list_users": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			users, err := store.ListUsers()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(users)
			return string(b), nil
		}
		return "", fmt.Errorf("not a storage module")
	},
	"storage_create_user": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			accessKey := getStringOpt(p, "access_key")
			secretKey := getStringOpt(p, "secret_key")
			user, err := store.CreateUser(accessKey, secretKey)
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(user)
			return string(b), nil
		}
		return "", fmt.Errorf("not a storage module")
	},
	"storage_delete_user": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			accessKey := getStringOpt(p, "access_key")
			if accessKey == "" {
				accessKey = getStringOpt(p, "username")
			}
			return "", store.DeleteUser(accessKey)
		}
		return "", fmt.Errorf("not a storage module")
	},
	// --- Ansible ---
	"ansible_run_playbook": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if ansible, ok := mod.(core.AnsibleModule); ok {
			playbook := getStringOpt(p, "playbook")
			inventory := getStringOpt(p, "inventory")
			vars := getStringOpt(p, "extra_vars")
			return ansible.RunPlaybook(playbook, inventory, vars)
		}
		return "", fmt.Errorf("not an ansible module")
	},

	// --- PM2 ---
	"pm2_list_apps": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if pm2, ok := mod.(core.PM2Module); ok {
			apps, err := pm2.GetApps()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(apps)
			return string(b), nil
		}
		return "", fmt.Errorf("not a pm2 module")
	},
	"pm2_get_listen_port": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if pm2, ok := mod.(core.PM2Module); ok {
			pidFloat := getFloatOpt(p, "pid")
			port, err := pm2.GetListenPort(int(pidFloat))
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("%d", port), nil
		}
		return "", fmt.Errorf("not a pm2 module")
	},

	// --- Proxy ---
	"proxy_list": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if proxy, ok := mod.(core.ProxyModule); ok {
			proxies, err := proxy.ListReverseProxies()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(proxies)
			return string(b), nil
		}
		return "", fmt.Errorf("not a proxy module")
	},
	"proxy_create": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if proxy, ok := mod.(core.ProxyModule); ok {
			domain := getStringOpt(p, "domain")
			portFloat := getFloatOpt(p, "port")
			return "", proxy.CreateReverseProxy(domain, int(portFloat))
		}
		return "", fmt.Errorf("not a proxy module")
	},
	"proxy_delete": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if proxy, ok := mod.(core.ProxyModule); ok {
			domain := getStringOpt(p, "domain")
			return "", proxy.DeleteReverseProxy(domain)
		}
		return "", fmt.Errorf("not a proxy module")
	},

	// --- MQTT ---
	"mq_create_user": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if mq, ok := mod.(core.MQTTModule); ok {
			user := getStringOpt(p, "username")
			pass := getStringOpt(p, "password")
			return "", mq.CreateUser(user, pass)
		}
		return "", fmt.Errorf("not a mqtt module")
	},
	"mq_delete_user": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if mq, ok := mod.(core.MQTTModule); ok {
			user := getStringOpt(p, "username")
			return "", mq.DeleteUser(user)
		}
		return "", fmt.Errorf("not a mqtt module")
	},

	// --- FTP ---
	"ftp_create_user": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if ftp, ok := mod.(core.FTPModule); ok {
			user := getStringOpt(p, "username")
			pass := getStringOpt(p, "password")
			path := getStringOpt(p, "root_path")
			quota := int(getFloatOpt(p, "quota"))
			enabled := getBoolOpt(p, "quota_enabled")
			return "", ftp.CreateUser(user, pass, path, quota, enabled)
		}
		return "", fmt.Errorf("not a ftp module")
	},
	"ftp_delete_user": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if ftp, ok := mod.(core.FTPModule); ok {
			user := getStringOpt(p, "username")
			return "", ftp.DeleteUser(user)
		}
		return "", fmt.Errorf("not a ftp module")
	},
	"ftp_list_users": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if ftp, ok := mod.(core.FTPModule); ok {
			users, err := ftp.ListUsers()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(users)
			return string(b), nil
		}
		return "", fmt.Errorf("not a ftp module")
	},
	"proxy_detect": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if proxy, ok := mod.(core.ProxyModule); ok {
			return proxy.GetProxyType(), nil
		}
		return "", fmt.Errorf("not a proxy module")
	},

	// --- Firewall (Generic) ---
	"firewall_allow": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			if !fw.IsActive() {
				return "", fmt.Errorf("firewall module %s is not the active engine", fw.TargetName())
			}
			portFloat := getFloatOpt(p, "port")
			protocol := getStringOpt(p, "protocol")
			if protocol == "" {
				protocol = "tcp"
			}
			return "", fw.AllowPort(int(portFloat), protocol)
		}
		return "", fmt.Errorf("not a firewall module")
	},
	"firewall_deny": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			if !fw.IsActive() {
				return "", fmt.Errorf("firewall module %s is not the active engine", fw.TargetName())
			}
			portFloat := getFloatOpt(p, "port")
			protocol := getStringOpt(p, "protocol")
			if protocol == "" {
				protocol = "tcp"
			}
			return "", fw.DenyPort(int(portFloat), protocol)
		}
		return "", fmt.Errorf("not a firewall module")
	},
	"firewall_list": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			if !fw.IsActive() {
				return "", fmt.Errorf("firewall module %s is not the active engine", fw.TargetName())
			}
			rules, err := fw.ListRules()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(rules)
			return string(b), nil
		}
		return "", fmt.Errorf("not a firewall module")
	},
	"firewall_add": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			if !fw.IsActive() {
				return "", fmt.Errorf("firewall module %s is not the active engine", fw.TargetName())
			}
			portFloat := getFloatOpt(p, "port")
			protocol := getStringOpt(p, "protocol")
			action := getStringOpt(p, "action")
			if protocol == "" {
				protocol = "tcp"
			}
			if action == "deny" {
				return "", fw.DenyPort(int(portFloat), protocol)
			}
			return "", fw.AllowPort(int(portFloat), protocol)
		}
		return "", fmt.Errorf("not a firewall module")
	},
	"firewall_delete": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			if !fw.IsActive() {
				return "", fmt.Errorf("firewall module %s is not the active engine", fw.TargetName())
			}
			ruleID := getStringOpt(p, "rule_id")
			return "", fw.DeleteRule(ruleID)
		}
		return "", fmt.Errorf("not a firewall module")
	},
	"firewall_default": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			if !fw.IsActive() {
				return "", fmt.Errorf("firewall module %s is not the active engine", fw.TargetName())
			}
			policy := getStringOpt(p, "policy")
			direction := getStringOpt(p, "direction")
			if direction == "" {
				direction = "incoming"
			}
			return "", fw.SetDefaultPolicy(policy, direction)
		}
		return "", fmt.Errorf("not a firewall module")
	},

	// UFW Aliases (Backward Compatibility)
	"ufw_allow": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			portFloat := getFloatOpt(p, "port")
			protocol := getStringOpt(p, "protocol")
			if protocol == "" {
				protocol = "tcp"
			}
			return "", fw.AllowPort(int(portFloat), protocol)
		}
		return "", fmt.Errorf("not a firewall module")
	},
	"ufw_deny": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			portFloat := getFloatOpt(p, "port")
			protocol := getStringOpt(p, "protocol")
			if protocol == "" {
				protocol = "tcp"
			}
			return "", fw.DenyPort(int(portFloat), protocol)
		}
		return "", fmt.Errorf("not a firewall module")
	},
	"ufw_list": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			rules, err := fw.ListRules()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(rules)
			return string(b), nil
		}
		return "", fmt.Errorf("not a firewall module")
	},
	"ufw_add": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			portFloat := getFloatOpt(p, "port")
			protocol := getStringOpt(p, "protocol")
			action := getStringOpt(p, "action")
			if protocol == "" {
				protocol = "tcp"
			}
			if action == "deny" {
				return "", fw.DenyPort(int(portFloat), protocol)
			}
			return "", fw.AllowPort(int(portFloat), protocol)
		}
		return "", fmt.Errorf("not a firewall module")
	},
	"ufw_delete": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			ruleID := getStringOpt(p, "rule_id")
			return "", fw.DeleteRule(ruleID)
		}
		return "", fmt.Errorf("not a firewall module")
	},
	"ufw_default": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			policy := getStringOpt(p, "policy")
			direction := getStringOpt(p, "direction")
			if direction == "" {
				direction = "incoming"
			}
			return "", fw.SetDefaultPolicy(policy, direction)
		}
		return "", fmt.Errorf("not a firewall module")
	},

	// --- CrowdSec ---
	"crowdsec_list": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if cs, ok := mod.(core.CrowdSecModule); ok {
			return cs.ListDecisions()
		}
		return "", fmt.Errorf("not a crowdsec module")
	},
	"crowdsec_add": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if cs, ok := mod.(core.CrowdSecModule); ok {
			ip := getStringOpt(p, "ip")
			duration := getStringOpt(p, "duration")
			reason := getStringOpt(p, "reason")
			decType := getStringOpt(p, "type")
			return "", cs.AddDecision(ip, duration, reason, decType)
		}
		return "", fmt.Errorf("not a crowdsec module")
	},
	"crowdsec_delete": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if cs, ok := mod.(core.CrowdSecModule); ok {
			id := getStringOpt(p, "id")
			return "", cs.DeleteDecision(id)
		}
		return "", fmt.Errorf("not a crowdsec module")
	},
	"crowdsec_delete_by_ip": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if cs, ok := mod.(core.CrowdSecModule); ok {
			ip := getStringOpt(p, "ip")
			return "", cs.DeleteDecisionByIP(ip)
		}
		return "", fmt.Errorf("not a crowdsec module")
	},
	// --- Configuration Management ---
	"service_get_config": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if cfgMod, ok := mod.(core.ConfigurableModule); ok {
			content, err := cfgMod.ReadConfig()
			if err != nil {
				return "", fmt.Errorf("failed to read config: %w", err)
			}
			return content, nil
		}
		return "", fmt.Errorf("service %s does not support configuration", mod.Name())
	},
	"service_update_config": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if cfgMod, ok := mod.(core.ConfigurableModule); ok {
			content := getStringOpt(p, "content")
			if content == "" {
				return "", fmt.Errorf("content is required")
			}

			if err := cfgMod.WriteConfig(content); err != nil {
				return "", fmt.Errorf("failed to write config: %w", err)
			}
			return "Configuration updated successfully", nil
		}
		return "", fmt.Errorf("service %s does not support configuration", mod.Name())
	},
	"systemd_list_all": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		// This is a global system action, but we use the module as a gateway if needed
		// Actually, any module can run this, but it's better if we have a way to call it.
		// For now, let's just implement the logic here.
		out, err := exec.Command("systemctl", "list-units", "--type=service", "--all", "--no-pager", "--no-legend").Output()
		if err != nil {
			return "", err
		}
		return string(out), nil
	},
	"service_register": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		name := getStringOpt(p, "name")
		svcType := getStringOpt(p, "type")
		svcName := getStringOpt(p, "service_name")
		userScope := getBoolOpt(p, "user_scope")

		if name == "" || svcType == "" || svcName == "" {
			return "", fmt.Errorf("name, type and service_name are required")
		}

		// Ensure conf.d exists
		confD := filepath.Join(filepath.Dir(ctx.ConfigPath), "conf.d")
		os.MkdirAll(confD, 0755)

		// Create sub-config
		subCfg := config.Config{
			Services: []config.ServiceConfig{
				{Name: name, Type: svcType, ServiceName: svcName, UserScope: userScope},
			},
		}
		subPath := filepath.Join(confD, "service-"+name+".toml")
		if err := config.Save(&subCfg, subPath); err != nil {
			return "", err
		}

		// Register module immediately
		switch svcType {
		case "systemd":
			ctx.Registry.Register(modules.NewSystemdModule(name, svcName, userScope))
		default:
			return "", fmt.Errorf("unsupported service type for registration: %s", svcType)
		}

		return "OK", nil
	},
	"service_unregister": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		name := getStringOpt(p, "name")
		if name == "" {
			return "", fmt.Errorf("name is required")
		}

		confD := filepath.Join(filepath.Dir(ctx.ConfigPath), "conf.d")
		subPath := filepath.Join(confD, "service-"+name+".toml")

		// Remove file
		os.Remove(subPath)

		// Unregister
		ctx.Registry.Unregister(name)

		return "OK", nil
	},
	"service_list_processes": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if pm, ok := mod.(core.ProcessManager); ok {
			procs, err := pm.ListProcesses()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(procs)
			return string(b), nil
		}
		return "", fmt.Errorf("module %s does not support process management", mod.Name())
	},
	"service_control_process": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if pm, ok := mod.(core.ProcessManager); ok {
			id := getStringOpt(p, "process_id")
			action := getStringOpt(p, "process_action")
			if id == "" || action == "" {
				return "", fmt.Errorf("process_id and process_action are required")
			}
			var err error
			switch action {
			case "start":
				err = pm.StartProcess(id)
			case "stop":
				err = pm.StopProcess(id)
			case "restart":
				err = pm.RestartProcess(id)
			default:
				err = fmt.Errorf("unknown process action: %s", action)
			}
			return "OK", err
		}
		return "", fmt.Errorf("module %s does not support process management", mod.Name())
	},
	"service_get_settings": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if settings, ok := mod.(core.ServiceSettings); ok {
			data, err := settings.GetSettings()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(data)
			return string(b), nil
		}
		return "", fmt.Errorf("module %s does not support structured settings", mod.Name())
	},
	"service_update_settings": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if settings, ok := mod.(core.ServiceSettings); ok {
			optsRaw, ok := p["options"]
			if !ok || optsRaw == nil {
				return "", fmt.Errorf("missing settings options")
			}
			opts, ok := optsRaw.(map[string]interface{})
			if !ok || opts == nil {
				return "", fmt.Errorf("invalid settings format")
			}
			return "", settings.UpdateSettings(opts)
		}
		return "", fmt.Errorf("module %s does not support structured settings", mod.Name())
	},
	"service_import_items": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		items := make(map[string]interface{})
		var importErrors []string

		// Database imports
		if db, ok := mod.(core.DatabaseModule); ok {
			dbs, err := db.ListDatabases()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list databases: %v", err))
			} else {
				items["databases"] = dbs
			}

			users, err := db.ListUsers()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list users: %v", err))
			} else {
				items["users"] = users
			}
		}

		// Valkey-specific imports
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			// Get Valkey info
			info, err := valkey.GetInfo()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to get valkey info: %v", err))
			} else {
				items["valkey_info"] = info
			}

			// List keys (limit to first 100)
			keys, err := valkey.ListKeys("*")
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list keys: %v", err))
			} else {
				if len(keys) > 100 {
					keys = keys[:100]
				}
				items["keys"] = keys
			}

			// List clients
			clients, err := valkey.ListClients()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list clients: %v", err))
			} else {
				items["clients"] = clients
			}

			// Get config
			config, err := valkey.GetConfig()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to get config: %v", err))
			} else {
				items["config"] = config
			}
		}

		// FTP imports
		if ftp, ok := mod.(core.FTPModule); ok {
			users, err := ftp.ListUsers()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list FTP users: %v", err))
			} else {
				items["ftp_users"] = users
			}
		}

		// Web server imports
		if web, ok := mod.(core.WebServerModule); ok {
			sites, err := web.ListSites()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list sites: %v", err))
			} else {
				items["sites"] = sites
			}
		}

		// Storage (S3) imports
		if s3, ok := mod.(core.StorageModule); ok {
			buckets, err := s3.ListBuckets()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list buckets: %v", err))
			} else {
				items["buckets"] = buckets
			}

			users, err := s3.ListUsers()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list storage users: %v", err))
			} else {
				items["storage_users"] = users
			}
		}

		// RabbitMQ imports
		if mq, ok := mod.(core.RabbitMQModule); ok {
			vhosts, err := mq.ListVHosts()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list vhosts: %v", err))
			} else {
				items["vhosts"] = vhosts
			}

			users, err := mq.ListUsers()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list MQ users: %v", err))
			} else {
				items["mq_users"] = users
			}

			// List exchanges and queues for each vhost
			exchanges := make(map[string][]string)
			queues := make(map[string][]string)
			for _, vhost := range vhosts {
				exchs, err := mq.ListExchanges(vhost)
				if err == nil {
					exchanges[vhost] = exchs
				}
				qs, err := mq.ListQueues(vhost)
				if err == nil {
					queues[vhost] = qs
				}
			}
			items["exchanges"] = exchanges
			items["queues"] = queues
		}

		// Process manager imports
		if pm, ok := mod.(core.ProcessManager); ok {
			procs, err := pm.ListProcesses()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list processes: %v", err))
			} else {
				items["processes"] = procs
			}
		}

		// MQTT imports
		if mqtt, ok := mod.(core.MQTTModule); ok {
			users, err := mqtt.ListUsers()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list MQTT users: %v", err))
			} else {
				items["mqtt_users"] = users
			}
		}

		// Proxy imports (for reverse proxy configuration)
		if proxy, ok := mod.(core.ProxyModule); ok {
			proxies, err := proxy.ListReverseProxies()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to list proxies: %v", err))
			} else {
				items["proxies"] = proxies
			}
		}

		// Add config path if module supports it
		if cfgMod, ok := mod.(core.ConfigurableModule); ok {
			items["config_path"] = cfgMod.GetConfigPath()
		}

		// Add service settings if available
		if settingsMod, ok := mod.(core.ServiceSettings); ok {
			settings, err := settingsMod.GetSettings()
			if err != nil {
				importErrors = append(importErrors, fmt.Sprintf("failed to get settings: %v", err))
			} else {
				items["settings"] = settings
			}
		}

		// Include any errors in the response
		if len(importErrors) > 0 {
			items["import_errors"] = importErrors
		}

		b, err := json.Marshal(items)
		if err != nil {
			return "", fmt.Errorf("failed to marshal import items: %w", err)
		}
		return string(b), nil
	},

	// service_get_config_path returns the configuration file path for a service
	"service_get_config_path": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if cfgMod, ok := mod.(core.ConfigurableModule); ok {
			return cfgMod.GetConfigPath(), nil
		}
		return "", fmt.Errorf("service %s does not support configuration", mod.Name())
	},

	// === Valkey-specific commands ===
	"valkey_get_info": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			info, err := valkey.GetInfo()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(info)
			return string(b), nil
		}
		return "", fmt.Errorf("not a valkey module")
	},
	"valkey_list_keys": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			pattern := getStringOpt(p, "pattern")
			keys, err := valkey.ListKeys(pattern)
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(keys)
			return string(b), nil
		}
		return "", fmt.Errorf("not a valkey module")
	},
	"valkey_get_key": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			key := getStringOpt(p, "key")
			if key == "" {
				return "", fmt.Errorf("key is required")
			}
			valkeyKey, err := valkey.GetKey(key)
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(valkeyKey)
			return string(b), nil
		}
		return "", fmt.Errorf("not a valkey module")
	},
	"valkey_set_key": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			key := getStringOpt(p, "key")
			value := getStringOpt(p, "value")
			ttl := getIntOpt(p, "ttl")

			if key == "" || value == "" {
				return "", fmt.Errorf("key and value are required")
			}

			if err := valkey.SetKey(key, value, ttl); err != nil {
				return "", err
			}
			return "Key set successfully", nil
		}
		return "", fmt.Errorf("not a valkey module")
	},
	"valkey_delete_key": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			key := getStringOpt(p, "key")
			if key == "" {
				return "", fmt.Errorf("key is required")
			}
			if err := valkey.DeleteKey(key); err != nil {
				return "", err
			}
			return "Key deleted successfully", nil
		}
		return "", fmt.Errorf("not a valkey module")
	},
	"valkey_list_clients": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			clients, err := valkey.ListClients()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(clients)
			return string(b), nil
		}
		return "", fmt.Errorf("not a valkey module")
	},
	"valkey_kill_client": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			addr := getStringOpt(p, "addr")
			if addr == "" {
				return "", fmt.Errorf("client address is required")
			}
			if err := valkey.KillClient(addr); err != nil {
				return "", err
			}
			return "Client killed successfully", nil
		}
		return "", fmt.Errorf("not a valkey module")
	},
	"valkey_get_config": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			config, err := valkey.GetConfig()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(config)
			return string(b), nil
		}
		return "", fmt.Errorf("not a valkey module")
	},
	"valkey_update_config": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			key := getStringOpt(p, "key")
			value := getStringOpt(p, "value")

			if key == "" || value == "" {
				return "", fmt.Errorf("key and value are required")
			}

			if err := valkey.UpdateConfig(key, value); err != nil {
				return "", err
			}
			return "Config updated successfully", nil
		}
		return "", fmt.Errorf("not a valkey module")
	},
	"valkey_flush_db": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			if err := valkey.FlushDB(); err != nil {
				return "", err
			}
			return "Database flushed successfully", nil
		}
		return "", fmt.Errorf("not a valkey module")
	},
	"valkey_save": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			if err := valkey.Save(); err != nil {
				return "", err
			}
			return "Save completed successfully", nil
		}
		return "", fmt.Errorf("not a valkey module")
	},
	"valkey_bgsave": func(mod core.ServiceModule, ctx *CommandContext, _ map[string]interface{}) (string, error) {
		if valkey, ok := mod.(*modules.ValkeyModule); ok {
			if err := valkey.BGSave(); err != nil {
				return "", err
			}
			return "Background save started", nil
		}
		return "", fmt.Errorf("not a valkey module")
	},

	// --- Agent Configuration ---
	"agent_set_hub_token": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		token := getStringOpt(p, "token")
		if token == "" {
			return "", fmt.Errorf("token is required")
		}

		// Update the hub token in config
		ctx.Config.Hub.Token = token

		// Save the config
		if err := config.Save(ctx.Config, ctx.ConfigPath); err != nil {
			return "", fmt.Errorf("failed to save config: %w", err)
		}

		return "Hub token saved successfully", nil
	},

	// --- Application Deployment ---
	"deploy_app": func(mod core.ServiceModule, ctx *CommandContext, p map[string]interface{}) (string, error) {
		if deploy, ok := mod.(*modules.DeploymentModule); ok {
			cfg := modules.DeployConfig{
				Name:           getStringOpt(p, "name"),
				SourceURL:      getStringOpt(p, "source_url"),
				SourceToken:    getStringOpt(p, "source_token"),
				Runtime:        getStringOpt(p, "runtime"),
				RuntimeVersion: getStringOpt(p, "runtime_version"),
				ProcessManager: getStringOpt(p, "process_manager"),
				StartCommand:   getStringOpt(p, "start_command"),
				DomainName:     getStringOpt(p, "domain_name"),
				InternalPort:   getIntOpt(p, "internal_port"),
				ProxyType:      getStringOpt(p, "proxy_type"),
			}

			// Parse env_vars from options
			if optsRaw, ok := p["options"]; ok {
				if opts, ok := optsRaw.(map[string]interface{}); ok {
					if envRaw, ok := opts["env_vars"]; ok {
						if envMap, ok := envRaw.(map[string]interface{}); ok {
							cfg.EnvVars = make(map[string]string)
							for k, v := range envMap {
								cfg.EnvVars[k] = fmt.Sprint(v)
							}
						}
					}
				}
			}

			result := deploy.DeployApp(cfg)

			// After deployment, configure proxy if needed
			if result.Success && cfg.DomainName != "" && cfg.ProxyType != "" && cfg.ProxyType != "none" && cfg.InternalPort > 0 {
				proxyMod, err := ctx.Registry.Get(cfg.ProxyType)
				if err == nil {
					if proxy, ok := proxyMod.(core.ProxyModule); ok {
						if proxyErr := proxy.CreateReverseProxy(cfg.DomainName, cfg.InternalPort); proxyErr != nil {
							result.Message += fmt.Sprintf(" (warning: proxy setup failed: %v)", proxyErr)
						} else {
							result.Message += fmt.Sprintf(" + proxy configured: %s → :%d", cfg.DomainName, cfg.InternalPort)
						}
					}
				}
			}

			b, _ := json.Marshal(result)
			if !result.Success {
				return string(b), fmt.Errorf("deployment failed: %s", result.Error)
			}
			return string(b), nil
		}
		return "", fmt.Errorf("not a deployment module")
	},
}
