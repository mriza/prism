package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"prism-server/internal/db"
	"prism-server/internal/models"
	"strings"
)

var ControlURL = "http://localhost:65432/api/control"

func sendInternalControlCommand(serverID, service, action string, options map[string]interface{}, authToken string) error {
	payload := map[string]interface{}{
		"agent_id": serverID,
		"service":  service,
		"action":   action,
		"options":  options,
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", ControlURL, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)

	client := &http.Client{}
	resp, err := client.Do(req)
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

	authToken := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")

	switch r.Method {
	case "GET":
		// Parse filters from query params
		filters := db.ServiceAccountFilters{
			ProjectID: r.URL.Query().Get("projectId"),
			ServerID:  r.URL.Query().Get("serverId"),
			ServiceID: r.URL.Query().Get("serviceId"),
			Category:  r.URL.Query().Get("category"),
			Type:      r.URL.Query().Get("type"),
			Status:    r.URL.Query().Get("status"),
			Search:    r.URL.Query().Get("search"),
		}

		accounts, err := db.GetServiceAccounts(filters)
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

		// Validate required fields
		if a.ServerID == "" {
			http.Error(w, "serverId is required", http.StatusBadRequest)
			return
		}

		// Set defaults
		if a.Type == "" {
			a.Type = "user"
		}
		if a.Category == "" {
			if a.ProjectID != "" {
				a.Category = "project"
			} else {
				a.Category = "independent"
			}
		}
		if a.Status == "" {
			a.Status = "active"
		}

		// Remote provisioning logic via Agent
		// Database provisioning
		if a.Type == "mysql" || a.Type == "postgresql" || a.Type == "mongodb" || a.Type == "rabbitmq" || a.Type == "valkey" {
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

			// Create Databases
			for _, dbName := range allDBs {
				err := sendInternalControlCommand(a.ServerID, string(a.Type), "db_create_db", map[string]interface{}{
					"name": dbName,
				}, authToken)
				if err != nil {
					http.Error(w, fmt.Sprintf("Failed to create database/vhost %s on server: %v", dbName, err), http.StatusInternalServerError)
					return
				}
			}

			// Create Users & Permissions
			if a.Username != "" && a.Password != "" {
				for _, dbName := range allDBs {
					err := sendInternalControlCommand(a.ServerID, string(a.Type), "db_create_user", map[string]interface{}{
						"username": a.Username,
						"password": a.Password,
						"role":     a.Role,
						"target":   dbName,
					}, authToken)
					if err != nil {
						http.Error(w, fmt.Sprintf("Failed to create user for database %s on server: %v", dbName, err), http.StatusInternalServerError)
						return
					}
				}
			}

			// RabbitMQ Advanced Provisioning
			if a.Type == "rabbitmq" {
				for _, b := range a.Bindings {
					if b.VHost != "" {
						if b.SourceExchange != "" {
							sendInternalControlCommand(a.ServerID, "rabbitmq", "rabbitmq_create_exchange", map[string]interface{}{
								"vhost": b.VHost,
								"name":  b.SourceExchange,
								"type":  "topic",
							}, authToken)
						}
						if b.DestinationQueue != "" {
							sendInternalControlCommand(a.ServerID, "rabbitmq", "rabbitmq_create_queue", map[string]interface{}{
								"vhost": b.VHost,
								"name":  b.DestinationQueue,
							}, authToken)
						}
						if b.SourceExchange != "" && b.DestinationQueue != "" {
							sendInternalControlCommand(a.ServerID, "rabbitmq", "db_create_binding", map[string]interface{}{
								"vhost":            b.VHost,
								"sourceExchange":   b.SourceExchange,
								"destinationQueue": b.DestinationQueue,
								"routingKey":       b.RoutingKey,
							}, authToken)
						}
					}
				}

				err := sendInternalControlCommand(a.ServerID, "rabbitmq", "db_sync", map[string]interface{}{
					"bindings": a.Bindings,
				}, authToken)
				if err != nil {
					log.Printf("Warning: failed to sync RabbitMQ bindings: %v", err)
				}
			}
		}

		// S3 Storage Provisioning
		if a.Type == "s3-minio" || a.Type == "s3-garage" || a.Type == "minio" {
			if a.Bucket != "" {
				sendInternalControlCommand(a.ServerID, string(a.Type), "storage_create_bucket", map[string]interface{}{
					"name": a.Bucket,
				}, authToken)
			}
			if a.AccessKey != "" {
				sendInternalControlCommand(a.ServerID, string(a.Type), "storage_create_user", map[string]interface{}{
					"access_key": a.AccessKey,
					"secret_key": a.SecretKey,
				}, authToken)
			}
		}

		// Web Server & Proxy Provisioning
		if a.Type == "web-caddy" || a.Type == "web-nginx" || a.Type == "caddy" || a.Type == "nginx" {
			svcType := a.Type
			if svcType == "caddy" {
				svcType = "web-caddy"
			}
			if svcType == "nginx" {
				svcType = "web-nginx"
			}
			if a.Endpoint != "" {
				sendInternalControlCommand(a.ServerID, svcType, "proxy_create", map[string]interface{}{
					"domain": a.Endpoint,
					"port":   float64(a.Port),
				}, authToken)
			}
		}

		// PM2 Proxy Provisioning
		if a.Type == "pm2" && a.PM2ProxyDomain != "" && a.PM2ProxyType != "none" && a.PM2ProxyType != "" {
			sendInternalControlCommand(a.ServerID, a.PM2ProxyType, "proxy_create", map[string]interface{}{
				"domain": a.PM2ProxyDomain,
				"port":   float64(a.PM2Port),
			}, authToken)
		}

		// MQTT Provisioning
		if a.Type == "mqtt-mosquitto" || a.Type == "mosquitto" {
			sendInternalControlCommand(a.ServerID, "mosquitto", "mq_create_user", map[string]interface{}{
				"username": a.Username,
				"password": a.Password,
			}, authToken)
		}

		// FTP Provisioning
		if a.Type == "ftp-vsftpd" || a.Type == "vsftpd" {
			sendInternalControlCommand(a.ServerID, "vsftpd", "ftp_create_user", map[string]interface{}{
				"username":  a.Username,
				"password":  a.Password,
				"root_path": a.RootPath,
			}, authToken)
		}

		// Open Firewall Port
		if a.Port > 0 {
			err := sendInternalControlCommand(a.ServerID, "firewall", "firewall_allow", map[string]interface{}{
				"port":     float64(a.Port),
				"protocol": "tcp",
			}, authToken)
			if err != nil {
				log.Printf("Warning: failed to open firewall port: %v", err)
			}
		}

		// Save to Local Hub DB
		created, err := db.CreateServiceAccount(a)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Log audit action
		db.LogAuditAction("system", "account_created", "service_account", created.ID, r.RemoteAddr, map[string]interface{}{
			"username":   created.Username,
			"server_id":  created.ServerID,
			"service_id": created.ServiceID,
			"category":   created.Category,
		})

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

	authToken := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")

	switch r.Method {
	case "GET":
		account, err := db.GetServiceAccountByID(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if account == nil {
			http.Error(w, "Account not found", http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(account)

	case "PUT":
		var a models.ServiceAccount
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}
		a.ID = id

		// Get existing account to compare
		existing, err := db.GetServiceAccountByID(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if existing == nil {
			http.Error(w, "Account not found", http.StatusNotFound)
			return
		}

		// Send update commands if applicable
		if a.Type == "mysql" || a.Type == "postgresql" || a.Type == "mongodb" || a.Type == "rabbitmq" || a.Type == "valkey" {
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

			// Update Privileges
			if a.Username != "" {
				for _, dbName := range allDBs {
					err := sendInternalControlCommand(a.ServerID, string(a.Type), "db_update_privileges", map[string]interface{}{
						"username": a.Username,
						"role":     a.Role,
						"target":   dbName,
					}, authToken)
					if err != nil {
						http.Error(w, fmt.Sprintf("Failed to update user privileges for %s on server: %v", dbName, err), http.StatusInternalServerError)
						return
					}
				}
			}

			// Sync Bindings for RabbitMQ
			if a.Type == "rabbitmq" {
				for _, b := range a.Bindings {
					if b.VHost != "" {
						if b.SourceExchange != "" {
							sendInternalControlCommand(a.ServerID, "rabbitmq", "rabbitmq_create_exchange", map[string]interface{}{
								"vhost": b.VHost,
								"name":  b.SourceExchange,
								"type":  "topic",
							}, authToken)
						}
						if b.DestinationQueue != "" {
							sendInternalControlCommand(a.ServerID, "rabbitmq", "rabbitmq_create_queue", map[string]interface{}{
								"vhost": b.VHost,
								"name":  b.DestinationQueue,
							}, authToken)
						}
						if b.SourceExchange != "" && b.DestinationQueue != "" {
							sendInternalControlCommand(a.ServerID, "rabbitmq", "db_create_binding", map[string]interface{}{
								"vhost":            b.VHost,
								"sourceExchange":   b.SourceExchange,
								"destinationQueue": b.DestinationQueue,
								"routingKey":       b.RoutingKey,
							}, authToken)
						}
					}
				}

				err := sendInternalControlCommand(a.ServerID, "rabbitmq", "db_sync", map[string]interface{}{
					"bindings": a.Bindings,
				}, authToken)
				if err != nil {
					log.Printf("Warning: failed to sync RabbitMQ bindings: %v", err)
				}
			}
		}

		// Sync S3
		if a.Type == "s3-minio" || a.Type == "s3-garage" || a.Type == "minio" {
			if a.Bucket != "" {
				sendInternalControlCommand(a.ServerID, string(a.Type), "storage_create_bucket", map[string]interface{}{
					"name": a.Bucket,
				}, authToken)
			}
			if a.AccessKey != "" {
				sendInternalControlCommand(a.ServerID, string(a.Type), "storage_create_user", map[string]interface{}{
					"access_key": a.AccessKey,
					"secret_key": a.SecretKey,
				}, authToken)
			}
		}

		// Sync Web/Proxy
		if a.Type == "web-caddy" || a.Type == "web-nginx" || a.Type == "caddy" || a.Type == "nginx" {
			svcType := a.Type
			if svcType == "caddy" {
				svcType = "web-caddy"
			}
			if svcType == "nginx" {
				svcType = "web-nginx"
			}
			if a.Endpoint != "" {
				sendInternalControlCommand(a.ServerID, svcType, "proxy_create", map[string]interface{}{
					"domain": a.Endpoint,
					"port":   float64(a.Port),
				}, authToken)
			}
		}

		// Sync PM2 Proxy
		if a.Type == "pm2" && a.PM2ProxyDomain != "" && a.PM2ProxyType != "none" && a.PM2ProxyType != "" {
			sendInternalControlCommand(a.ServerID, a.PM2ProxyType, "proxy_create", map[string]interface{}{
				"domain": a.PM2ProxyDomain,
				"port":   float64(a.PM2Port),
			}, authToken)
		}

		// Sync MQTT
		if a.Type == "mqtt-mosquitto" || a.Type == "mosquitto" {
			sendInternalControlCommand(a.ServerID, "mosquitto", "mq_create_user", map[string]interface{}{
				"username": a.Username,
				"password": a.Password,
			}, authToken)
		}

		// Sync FTP
		if a.Type == "ftp-vsftpd" || a.Type == "vsftpd" {
			sendInternalControlCommand(a.ServerID, "vsftpd", "ftp_create_user", map[string]interface{}{
				"username":  a.Username,
				"password":  a.Password,
				"root_path": a.RootPath,
			}, authToken)
		}

		if err := db.UpdateServiceAccount(a); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Log audit action
		db.LogAuditAction("system", "account_updated", "service_account", a.ID, r.RemoteAddr, map[string]interface{}{
			"username": a.Username,
			"status":   a.Status,
		})

		json.NewEncoder(w).Encode(a)

	case "DELETE":
		// Get account for audit log
		account, err := db.GetServiceAccountByID(id)
		if err == nil && account != nil {
			db.LogAuditAction("system", "account_deleted", "service_account", id, r.RemoteAddr, map[string]interface{}{
				"username": account.Username,
			})
		}

		if err := db.DeleteServiceAccount(id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
