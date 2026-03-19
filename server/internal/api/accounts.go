package api

import (
	"bytes"
	"encoding/json"
	"prism-server/internal/db"
	"prism-server/internal/models"
	"fmt"
	"log"
	"net/http"
	"strings"
)

var ControlURL = "http://localhost:65432/api/control"

func sendInternalControlCommand(agentID, service, action string, options map[string]interface{}) error {
	payload := map[string]interface{}{
		"agent_id": agentID,
		"service":  service,
		"action":   action,
		"options":  options,
	}
	b, _ := json.Marshal(payload)
	resp, err := http.Post(ControlURL, "application/json", bytes.NewReader(b))
	if err != nil {
		log.Printf("Error sending internal control command: %v", err)
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("control api returned status %d", resp.StatusCode)
	}
	return nil
}

func HandleAccounts(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		projectID := r.URL.Query().Get("projectId")
		accounts, err := db.GetServiceAccounts(projectID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if accounts == nil {
			accounts = []models.ServiceAccount{}
		}
		json.NewEncoder(w).Encode(accounts)

	case "POST":
		var a models.ServiceAccount
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		// 1. Remote Provisioning Logic via Agent
		if a.Type == "mysql" || a.Type == "postgresql" || a.Type == "mongodb" || a.Type == "rabbitmq" {
			// Handle legacy single-database field and new multiple-databases array
			allDBs := a.Databases
			if a.Database != "" {
				// check if already in slice
				found := false
				for _, d := range allDBs {
					if d == a.Database {
						found = true
						break
					}
				}
				if !found {
					allDBs = append(allDBs, a.Database)
				}
			}

			// 1.1 Create Databases
			for _, dbName := range allDBs {
				err := sendInternalControlCommand(a.AgentID, string(a.Type), "db_create_db", map[string]interface{}{
					"name": dbName,
				})
				if err != nil {
					http.Error(w, fmt.Sprintf("Failed to create database/vhost %s on agent: %v", dbName, err), http.StatusInternalServerError)
					return
				}
			}

			// 1.2 Create Users & Permissions
			if a.Username != "" && a.Password != "" {
				for _, dbName := range allDBs {
					err := sendInternalControlCommand(a.AgentID, string(a.Type), "db_create_user", map[string]interface{}{
						"username": a.Username,
						"password": a.Password,
						"role":     a.Role,
						"target":   dbName, // Target database or vhost
					})
					if err != nil {
						http.Error(w, fmt.Sprintf("Failed to create user for database %s on agent: %v", dbName, err), http.StatusInternalServerError)
						return
					}
				}
			}

			// 1.3 RabbitMQ Advanced Provisioning (Exchanges, Queues, Bindings)
			if a.Type == "rabbitmq" {
				// Ensure Queues and Exchanges exist for each binding
				for _, b := range a.Bindings {
					if b.VHost != "" {
						if b.SourceExchange != "" {
							sendInternalControlCommand(a.AgentID, "rabbitmq", "rabbitmq_create_exchange", map[string]interface{}{
								"vhost": b.VHost,
								"name":  b.SourceExchange,
								"type":  "topic",
							})
						}
						if b.DestinationQueue != "" {
							sendInternalControlCommand(a.AgentID, "rabbitmq", "rabbitmq_create_queue", map[string]interface{}{
								"vhost": b.VHost,
								"name":  b.DestinationQueue,
							})
						}
						if b.SourceExchange != "" && b.DestinationQueue != "" {
							sendInternalControlCommand(a.AgentID, "rabbitmq", "db_create_binding", map[string]interface{}{
								"vhost":            b.VHost,
								"sourceExchange":   b.SourceExchange,
								"destinationQueue": b.DestinationQueue,
								"routingKey":       b.RoutingKey,
							})
						}
					}
				}

				// Final sync
				err := sendInternalControlCommand(a.AgentID, "rabbitmq", "db_sync", map[string]interface{}{
					"bindings": a.Bindings,
				})
				if err != nil {
					log.Printf("Warning: failed to sync RabbitMQ bindings: %v", err)
				}
			}

			// 1.4 S3 Storage Provisioning
			if a.Type == "s3-minio" || a.Type == "s3-garage" {
				if a.Bucket != "" {
					sendInternalControlCommand(a.AgentID, string(a.Type), "storage_create_bucket", map[string]interface{}{
						"name": a.Bucket,
					})
				}
				if a.AccessKey != "" {
					sendInternalControlCommand(a.AgentID, string(a.Type), "storage_create_user", map[string]interface{}{
						"access_key": a.AccessKey,
						"secret_key": a.SecretKey,
					})
				}
			}

			// 1.5 Web Server & Proxy Provisioning
			if a.Type == "web-caddy" || a.Type == "web-nginx" {
				if a.Endpoint != "" {
					sendInternalControlCommand(a.AgentID, string(a.Type), "proxy_create", map[string]interface{}{
						"domain": a.Endpoint,
						"port":   float64(a.Port),
					})
				}
			}

			// 1.6 PM2 Proxy Provisioning
			if a.Type == "pm2" && a.PM2ProxyDomain != "" && a.PM2ProxyType != "none" && a.PM2ProxyType != "" {
				sendInternalControlCommand(a.AgentID, a.PM2ProxyType, "proxy_create", map[string]interface{}{
					"domain": a.PM2ProxyDomain,
					"port":   float64(a.PM2Port),
				})
			}

			// 1.7 MQTT Provisioning
			if a.Type == "mqtt-mosquitto" {
				sendInternalControlCommand(a.AgentID, "mosquitto", "mq_create_user", map[string]interface{}{
					"username": a.Username,
					"password": a.Password,
				})
			}

			// 1.8 FTP Provisioning
			if a.Type == "ftp-vsftpd" {
				sendInternalControlCommand(a.AgentID, "vsftpd", "ftp_create_user", map[string]interface{}{
					"username":  a.Username,
					"password":  a.Password,
					"root_path": a.RootPath,
				})
			}
		}

		// 2. Open Firewall Port
		if a.Port > 0 {
			err := sendInternalControlCommand(a.AgentID, "firewall", "firewall_allow", map[string]interface{}{
				"port":     float64(a.Port),
				"protocol": "tcp",
			})
			if err != nil {
				log.Printf("Warning: failed to open firewall port: %v", err)
			}
		}

		// 3. Save to Local Hub DB
		created, err := db.CreateServiceAccount(a)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func HandleAccountDetail(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/accounts/")
	if id == "" {
		http.Error(w, "Account ID missing", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case "PUT":
		var a models.ServiceAccount
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}
		a.ID = id

		// Send Update Privileges Command to Agent if applicable
		if a.Type == "mysql" || a.Type == "postgresql" || a.Type == "mongodb" || a.Type == "rabbitmq" {
			// Handle legacy single-database field and new multiple-databases array
			allDBs := a.Databases
			if a.Database != "" {
				found := false
				for _, d := range allDBs {
					if d == a.Database {
						found = true
						break
					}
				}
				if !found {
					allDBs = append(allDBs, a.Database)
				}
			}

			// 2.1 Ensure Databases/VHosts Exist
			for _, dbName := range allDBs {
				err := sendInternalControlCommand(a.AgentID, string(a.Type), "db_create_db", map[string]interface{}{
					"name": dbName,
				})
				if err != nil {
					http.Error(w, fmt.Sprintf("Failed to ensure database/vhost %s exists on agent: %v", dbName, err), http.StatusInternalServerError)
					return
				}
			}

			// 2.2 Update Privileges
			if a.Username != "" {
				for _, dbName := range allDBs {
					err := sendInternalControlCommand(a.AgentID, string(a.Type), "db_update_privileges", map[string]interface{}{
						"username": a.Username,
						"role":     a.Role,
						"target":   dbName,
					})
					if err != nil {
						http.Error(w, fmt.Sprintf("Failed to update user privileges for %s on agent: %v", dbName, err), http.StatusInternalServerError)
						return
					}
				}
			}

			// Sync Bindings for RabbitMQ
			if a.Type == "rabbitmq" {
				// Ensure Queues and Exchanges exist for each binding
				for _, b := range a.Bindings {
					if b.VHost != "" {
						if b.SourceExchange != "" {
							sendInternalControlCommand(a.AgentID, "rabbitmq", "rabbitmq_create_exchange", map[string]interface{}{
								"vhost": b.VHost,
								"name":  b.SourceExchange,
								"type":  "topic",
							})
						}
						if b.DestinationQueue != "" {
							sendInternalControlCommand(a.AgentID, "rabbitmq", "rabbitmq_create_queue", map[string]interface{}{
								"vhost": b.VHost,
								"name":  b.DestinationQueue,
							})
						}
						if b.SourceExchange != "" && b.DestinationQueue != "" {
							sendInternalControlCommand(a.AgentID, "rabbitmq", "db_create_binding", map[string]interface{}{
								"vhost":            b.VHost,
								"sourceExchange":   b.SourceExchange,
								"destinationQueue": b.DestinationQueue,
								"routingKey":       b.RoutingKey,
							})
						}
					}
				}

				err := sendInternalControlCommand(a.AgentID, "rabbitmq", "db_sync", map[string]interface{}{
					"bindings": a.Bindings,
				})
				if err != nil {
					log.Printf("Warning: failed to sync RabbitMQ bindings: %v", err)
				}
			}

			// Sync S3 Buckets/Users
			if a.Type == "s3-minio" || a.Type == "s3-garage" {
				if a.Bucket != "" {
					sendInternalControlCommand(a.AgentID, string(a.Type), "storage_create_bucket", map[string]interface{}{
						"name": a.Bucket,
					})
				}
				if a.AccessKey != "" {
					sendInternalControlCommand(a.AgentID, string(a.Type), "storage_create_user", map[string]interface{}{
						"access_key": a.AccessKey,
						"secret_key": a.SecretKey,
					})
				}
			}

			// Sync Web/Proxy
			if a.Type == "web-caddy" || a.Type == "web-nginx" {
				if a.Endpoint != "" {
					sendInternalControlCommand(a.AgentID, string(a.Type), "proxy_create", map[string]interface{}{
						"domain": a.Endpoint,
						"port":   float64(a.Port),
					})
				}
			}

			// Sync PM2 Proxy
			if a.Type == "pm2" && a.PM2ProxyDomain != "" && a.PM2ProxyType != "none" && a.PM2ProxyType != "" {
				sendInternalControlCommand(a.AgentID, a.PM2ProxyType, "proxy_create", map[string]interface{}{
					"domain": a.PM2ProxyDomain,
					"port":   float64(a.PM2Port),
				})
			}

			// Sync MQTT
			if a.Type == "mqtt-mosquitto" {
				sendInternalControlCommand(a.AgentID, "mosquitto", "mq_create_user", map[string]interface{}{
					"username": a.Username,
					"password": a.Password,
				})
			}

			// Sync FTP
			if a.Type == "ftp-vsftpd" {
				sendInternalControlCommand(a.AgentID, "vsftpd", "ftp_create_user", map[string]interface{}{
					"username":  a.Username,
					"password":  a.Password,
					"root_path": a.RootPath,
				})
			}
		}

		if err := db.UpdateServiceAccount(a); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(a)

	case "DELETE":
		if err := db.DeleteServiceAccount(id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
