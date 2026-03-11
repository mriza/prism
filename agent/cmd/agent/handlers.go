package main

import (
	"encoding/json"
	"fmt"
	"prism-agent/internal/core"
)

// CommandHandlerFunc defines the signature for a command handler
type CommandHandlerFunc func(mod core.ServiceModule, payload map[string]interface{}) (string, error)

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
		if err != nil {
			return "", err
		}
		b, _ := json.Marshal(facts)
		return string(b), nil
	},

	// --- Database ---
	"db_list_dbs": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
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
	"db_create_db": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		name := getStringOpt(p, "name")
		if db, ok := mod.(core.DatabaseModule); ok {
			return "", db.CreateDatabase(name)
		}
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			return "", rmq.CreateVHost(name)
		}
		return "", fmt.Errorf("module does not support database/vhost creation")
	},
	"db_list_users": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		if db, ok := mod.(core.DatabaseModule); ok {
			users, err := db.ListUsers()
			if err != nil {
				return "", err
			}
			b, _ := json.Marshal(users)
			return string(b), nil
		}
		return "", fmt.Errorf("module does not support database operations")
	},
	"db_create_user": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if db, ok := mod.(core.DatabaseModule); ok {
			user := getStringOpt(p, "username")
			pass := getStringOpt(p, "password")
			role := getStringOpt(p, "role")
			target := getStringOpt(p, "target")
			return "", db.CreateUser(user, pass, role, target)
		}
		return "", fmt.Errorf("module does not support database operations")
	},
	"db_update_privileges": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if db, ok := mod.(core.DatabaseModule); ok {
			user := getStringOpt(p, "username")
			role := getStringOpt(p, "role")
			target := getStringOpt(p, "target")
			return "", db.UpdatePrivileges(user, role, target)
		}
		return "", fmt.Errorf("module does not support database operations")
	},
	"db_create_binding": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			vhost := getStringOpt(p, "vhost")
			queue := getStringOpt(p, "destinationQueue") // Changed to match server names
			exchange := getStringOpt(p, "sourceExchange")
			routingKey := getStringOpt(p, "routingKey")
			return "", rmq.CreateBinding(vhost, exchange, queue, routingKey)
		}
		return "", fmt.Errorf("module does not support binding operations")
	},
	"db_sync": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			bindings := getInterfaceSliceOpt(p, "bindings")
			return "", rmq.SyncBindings(bindings)
		}
		return "", fmt.Errorf("module does not support sync operations")
	},

	// --- RabbitMQ ---
	"rmq_list_vhosts": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
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
	"rmq_create_vhost": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			name := getStringOpt(p, "name")
			return "", rmq.CreateVHost(name)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_delete_vhost": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			name := getStringOpt(p, "name")
			return "", rmq.DeleteVHost(name)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_list_users": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
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
	"rmq_create_user": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			user := getStringOpt(p, "username")
			pass := getStringOpt(p, "password")
			role := getStringOpt(p, "role")
			target := getStringOpt(p, "vhost")
			return "", rmq.CreateUser(user, pass, role, target)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_set_permissions": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			vhost := getStringOpt(p, "vhost")
			user := getStringOpt(p, "username")
			return "", rmq.SetPermissions(vhost, user, ".*", ".*", ".*")
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rmq_create_binding": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			vhost := getStringOpt(p, "vhost")
			queue := getStringOpt(p, "queue")
			exchange := getStringOpt(p, "exchange")
			routingKey := getStringOpt(p, "routing_key")
			return "", rmq.CreateBinding(vhost, exchange, queue, routingKey)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},
	"rabbitmq_sync": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if rmq, ok := mod.(core.RabbitMQModule); ok {
			bindings := getInterfaceSliceOpt(p, "bindings")
			return "", rmq.SyncBindings(bindings)
		}
		return "", fmt.Errorf("not a rabbitmq module")
	},

	// --- Web Server ---
	"web_list_sites": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
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
	"web_create_site": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			name := getStringOpt(p, "name")
			content := getStringOpt(p, "content")
			return "", web.CreateSite(name, content)
		}
		return "", fmt.Errorf("not a web server module")
	},
	"web_delete_site": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			name := getStringOpt(p, "name")
			return "", web.DeleteSite(name)
		}
		return "", fmt.Errorf("not a web server module")
	},
	"web_enable_site": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			name := getStringOpt(p, "name")
			return "", web.EnableSite(name)
		}
		return "", fmt.Errorf("not a web server module")
	},
	"web_disable_site": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if web, ok := mod.(core.WebServerModule); ok {
			name := getStringOpt(p, "name")
			return "", web.DisableSite(name)
		}
		return "", fmt.Errorf("not a web server module")
	},

	// --- Storage ---
	"storage_list_buckets": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
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
	"storage_create_bucket": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			name := getStringOpt(p, "name")
			return "", store.CreateBucket(name)
		}
		return "", fmt.Errorf("not a storage module")
	},
	"storage_delete_bucket": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if store, ok := mod.(core.StorageModule); ok {
			name := getStringOpt(p, "name")
			return "", store.DeleteBucket(name)
		}
		return "", fmt.Errorf("not a storage module")
	},
	"storage_list_users": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
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
	"storage_create_user": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
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
	"storage_delete_user": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
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
	"ansible_run_playbook": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if ansible, ok := mod.(core.AnsibleModule); ok {
			playbook := getStringOpt(p, "playbook")
			inventory := getStringOpt(p, "inventory")
			vars := getStringOpt(p, "extra_vars")
			return ansible.RunPlaybook(playbook, inventory, vars)
		}
		return "", fmt.Errorf("not an ansible module")
	},

	// --- PM2 ---
	"pm2_list_apps": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
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
	"pm2_get_listen_port": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
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
	"proxy_list": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
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
	"proxy_create": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if proxy, ok := mod.(core.ProxyModule); ok {
			domain := getStringOpt(p, "domain")
			portFloat := getFloatOpt(p, "port")
			return "", proxy.CreateReverseProxy(domain, int(portFloat))
		}
		return "", fmt.Errorf("not a proxy module")
	},
	"proxy_delete": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if proxy, ok := mod.(core.ProxyModule); ok {
			domain := getStringOpt(p, "domain")
			return "", proxy.DeleteReverseProxy(domain)
		}
		return "", fmt.Errorf("not a proxy module")
	},

	// --- MQTT ---
	"mq_create_user": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if mq, ok := mod.(core.MQTTModule); ok {
			user := getStringOpt(p, "username")
			pass := getStringOpt(p, "password")
			return "", mq.CreateUser(user, pass)
		}
		return "", fmt.Errorf("not a mqtt module")
	},
	"mq_delete_user": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if mq, ok := mod.(core.MQTTModule); ok {
			user := getStringOpt(p, "username")
			return "", mq.DeleteUser(user)
		}
		return "", fmt.Errorf("not a mqtt module")
	},

	// --- FTP ---
	"ftp_create_user": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
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
	"ftp_delete_user": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if ftp, ok := mod.(core.FTPModule); ok {
			user := getStringOpt(p, "username")
			return "", ftp.DeleteUser(user)
		}
		return "", fmt.Errorf("not a ftp module")
	},
	"proxy_detect": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		if proxy, ok := mod.(core.ProxyModule); ok {
			return proxy.GetProxyType(), nil
		}
		return "", fmt.Errorf("not a proxy module")
	},

	// --- Firewall (Generic) ---
	"firewall_allow": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
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
	"firewall_deny": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
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
	"firewall_list": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
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
	"firewall_add": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
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
	"firewall_delete": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			if !fw.IsActive() {
				return "", fmt.Errorf("firewall module %s is not the active engine", fw.TargetName())
			}
			ruleID := getStringOpt(p, "rule_id")
			return "", fw.DeleteRule(ruleID)
		}
		return "", fmt.Errorf("not a firewall module")
	},
	"firewall_default": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
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
	"ufw_allow": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
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
	"ufw_deny": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
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
	"ufw_list": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
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
	"ufw_add": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
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
	"ufw_delete": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if fw, ok := mod.(core.FirewallModule); ok {
			ruleID := getStringOpt(p, "rule_id")
			return "", fw.DeleteRule(ruleID)
		}
		return "", fmt.Errorf("not a firewall module")
	},
	"ufw_default": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
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
	"crowdsec_list": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		if cs, ok := mod.(core.CrowdSecModule); ok {
			return cs.ListDecisions()
		}
		return "", fmt.Errorf("not a crowdsec module")
	},
	"crowdsec_add": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if cs, ok := mod.(core.CrowdSecModule); ok {
			ip := getStringOpt(p, "ip")
			duration := getStringOpt(p, "duration")
			reason := getStringOpt(p, "reason")
			decType := getStringOpt(p, "type")
			return "", cs.AddDecision(ip, duration, reason, decType)
		}
		return "", fmt.Errorf("not a crowdsec module")
	},
	"crowdsec_delete": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if cs, ok := mod.(core.CrowdSecModule); ok {
			id := getStringOpt(p, "id")
			return "", cs.DeleteDecision(id)
		}
		return "", fmt.Errorf("not a crowdsec module")
	},
	"crowdsec_delete_by_ip": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if cs, ok := mod.(core.CrowdSecModule); ok {
			ip := getStringOpt(p, "ip")
			return "", cs.DeleteDecisionByIP(ip)
		}
		return "", fmt.Errorf("not a crowdsec module")
	},
	// --- Configuration Management ---
	"service_get_config": func(mod core.ServiceModule, _ map[string]interface{}) (string, error) {
		if cfg, ok := mod.(core.ConfigurableModule); ok {
			return cfg.ReadConfig()
		}
		return "", fmt.Errorf("module %s does not support configuration management", mod.Name())
	},
	"service_update_config": func(mod core.ServiceModule, p map[string]interface{}) (string, error) {
		if cfg, ok := mod.(core.ConfigurableModule); ok {
			content := getStringOpt(p, "content")
			return "", cfg.WriteConfig(content)
		}
		return "", fmt.Errorf("module %s does not support configuration management", mod.Name())
	},
}
