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

// isValkeyType checks if the service type is any Valkey variant
func isValkeyType(t string) bool {
	return t == "valkey" || t == "valkey-server" ||
		t == "valkey-cache" || t == "valkey-broker" || t == "valkey-nosql"
}

// isDatabaseType checks if the service type supports database provisioning
func isDatabaseType(t string) bool {
	return t == "mysql" || t == "postgresql" || t == "mongodb" || t == "rabbitmq" || isValkeyType(t)
}

func sendInternalControlCommand(serverID, service, action string, options map[string]interface{}, authToken string) error {
	payload := map[string]interface{}{
		"agent_id": serverID,
		"service":  service,
		"action":   action,
		"options":  options,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal control payload: %w", err)
	}
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

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
		if errMsg, ok := result["error"].(string); ok && errMsg != "" {
			return fmt.Errorf("agent error: %s", errMsg)
		}
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
		if a.Role == "" {
			a.Role = "readwrite"
		}

		// Remote provisioning logic via Agent
		// Database provisioning
		if isDatabaseType(a.Type) {
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

			// Determine the canonical service name for agent commands
			agentService := string(a.Type)
			if isValkeyType(a.Type) {
				agentService = "valkey"
			}

			// Create Databases (skip for Valkey cache/broker modes)
			if a.Type != "valkey-cache" && a.Type != "valkey-broker" {
				for _, dbName := range allDBs {
					err := sendInternalControlCommand(a.ServerID, agentService, "db_create_db", map[string]interface{}{
						"name": dbName,
					}, authToken)
					if err != nil {
						http.Error(w, fmt.Sprintf("Failed to create database/vhost %s on server: %v", dbName, err), http.StatusInternalServerError)
						return
					}
				}
			}

			// Create Users & Permissions
			if a.Username != "" && a.Password != "" {
				for _, dbName := range allDBs {
					err := sendInternalControlCommand(a.ServerID, agentService, "db_create_user", map[string]interface{}{
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
				// Create exchanges, queues, and bindings
				for _, b := range a.Bindings {
					if b.VHost != "" {
						if b.SourceExchange != "" {
							err := sendInternalControlCommand(a.ServerID, "rabbitmq", "rabbitmq_create_exchange", map[string]interface{}{
								"vhost": b.VHost,
								"name":  b.SourceExchange,
								"type":  "topic",
							}, authToken)
							if err != nil {
								log.Printf("Warning: failed to create RabbitMQ exchange %s: %v", b.SourceExchange, err)
							}
						}
						if b.DestinationQueue != "" {
							err := sendInternalControlCommand(a.ServerID, "rabbitmq", "rabbitmq_create_queue", map[string]interface{}{
								"vhost": b.VHost,
								"name":  b.DestinationQueue,
							}, authToken)
							if err != nil {
								log.Printf("Warning: failed to create RabbitMQ queue %s: %v", b.DestinationQueue, err)
							}
						}
						if b.SourceExchange != "" && b.DestinationQueue != "" {
							err := sendInternalControlCommand(a.ServerID, "rabbitmq", "db_create_binding", map[string]interface{}{
								"vhost":            b.VHost,
								"sourceExchange":   b.SourceExchange,
								"destinationQueue": b.DestinationQueue,
								"routingKey":       b.RoutingKey,
							}, authToken)
							if err != nil {
								log.Printf("Warning: failed to create RabbitMQ binding: %v", err)
							}
						}
					}
				}

				// Sync bindings - return error to user if sync fails
				err := sendInternalControlCommand(a.ServerID, "rabbitmq", "db_sync", map[string]interface{}{
					"bindings": a.Bindings,
				}, authToken)
				if err != nil {
					log.Printf("Warning: failed to sync RabbitMQ bindings: %v", err)
					// Return warning to user but don't fail the entire operation
					// Account and user are created, but bindings may be incomplete
					w.Header().Set("X-RabbitMQ-Warning", "Bindings sync failed: "+err.Error())
				}
			}
		}

		// S3 Storage Provisioning
		if a.Type == "s3-minio" || a.Type == "s3-garage" || a.Type == "minio" {
			agentSvc := strings.TrimPrefix(string(a.Type), "s3-")
			if a.Bucket != "" {
				err := sendInternalControlCommand(a.ServerID, agentSvc, "storage_create_bucket", map[string]interface{}{
					"name": a.Bucket,
				}, authToken)
				if err != nil {
					http.Error(w, fmt.Sprintf("Failed to create storage bucket: %v", err), http.StatusInternalServerError)
					return
				}
			}
			if a.AccessKey != "" {
				err := sendInternalControlCommand(a.ServerID, agentSvc, "storage_create_user", map[string]interface{}{
					"access_key": a.AccessKey,
					"secret_key": a.SecretKey,
				}, authToken)
				if err != nil {
					http.Error(w, fmt.Sprintf("Failed to create storage access keys: %v", err), http.StatusInternalServerError)
					return
				}
			}
		}

		// Web Server & Proxy Provisioning
		if a.Type == "web-caddy" || a.Type == "web-nginx" || a.Type == "caddy" || a.Type == "nginx" {
			agentSvc := strings.TrimPrefix(string(a.Type), "web-")
			if a.Endpoint != "" {
				err := sendInternalControlCommand(a.ServerID, agentSvc, "proxy_create", map[string]interface{}{
					"domain": a.Endpoint,
					"port":   float64(a.Port),
				}, authToken)
				if err != nil {
					http.Error(w, fmt.Sprintf("Failed to create web proxy route: %v", err), http.StatusInternalServerError)
					return
				}
			}
		}

		// PM2 Proxy Provisioning
		if a.Type == "pm2" && a.PM2ProxyDomain != "" && a.PM2ProxyType != "none" && a.PM2ProxyType != "" {
			err := sendInternalControlCommand(a.ServerID, string(a.PM2ProxyType), "proxy_create", map[string]interface{}{
				"domain": a.PM2ProxyDomain,
				"port":   float64(a.PM2Port),
			}, authToken)
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to configure PM2 reverse proxy: %v", err), http.StatusInternalServerError)
				return
			}
		}

		// MQTT Provisioning
		if a.Type == "mqtt-mosquitto" || a.Type == "mosquitto" {
			err := sendInternalControlCommand(a.ServerID, "mosquitto", "mq_create_user", map[string]interface{}{
				"username": a.Username,
				"password": a.Password,
			}, authToken)
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to create MQTT credentials: %v", err), http.StatusInternalServerError)
				return
			}
		}

		// FTP Provisioning
		if a.Type == "ftp-vsftpd" || a.Type == "vsftpd" || a.Type == "ftp-sftpgo" || a.Type == "sftpgo" {
			agentSvc := strings.TrimPrefix(string(a.Type), "ftp-")
			err := sendInternalControlCommand(a.ServerID, agentSvc, "ftp_create_user", map[string]interface{}{
				"username":  a.Username,
				"password":  a.Password,
				"root_path": a.RootPath,
			}, authToken)
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to provision FTP user: %v", err), http.StatusInternalServerError)
				return
			}
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

func HandleAccountCrossReference(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	filters := db.ServiceAccountFilters{
		ProjectID: r.URL.Query().Get("projectId"),
		ServerID:  r.URL.Query().Get("serverId"),
		Category:  r.URL.Query().Get("category"),
		Search:    r.URL.Query().Get("search"),
	}
	results, err := db.GetAccountsCrossReference(filters)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if results == nil {
		results = []map[string]interface{}{}
	}
	json.NewEncoder(w).Encode(results)
}

func HandleAccountsBulkProject(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var payload struct {
		AccountIDs []string `json:"accountIds"`
		ProjectID  string   `json:"projectId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}
	if err := db.BulkUpdateAccountsProject(payload.AccountIDs, payload.ProjectID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func HandleAccountsBulkDisable(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var payload struct {
		AccountIDs []string `json:"accountIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}
	if err := db.BulkDisableAccounts(payload.AccountIDs); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
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

	// Intercept sub-routes
	if id == "cross-reference" {
		HandleAccountCrossReference(w, r)
		return
	}
	if id == "bulk-project" {
		HandleAccountsBulkProject(w, r)
		return
	}
	if id == "bulk-disable" {
		HandleAccountsBulkDisable(w, r)
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
		if isDatabaseType(a.Type) {
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

			// Determine the canonical service name for agent commands
			agentService := string(a.Type)
			if isValkeyType(a.Type) {
				agentService = "valkey"
			}

			// Check for newly added databases and create them
			oldDBs := existing.Databases
			for _, newDB := range allDBs {
				found := false
				for _, oldDB := range oldDBs {
					if oldDB == newDB {
						found = true
						break
					}
				}
				// Create database if it's newly added (skip for Valkey cache/broker)
				if !found && a.Type != "valkey-cache" && a.Type != "valkey-broker" {
					err := sendInternalControlCommand(a.ServerID, agentService, "db_create_db", map[string]interface{}{
						"name": newDB,
					}, authToken)
					if err != nil {
						http.Error(w, fmt.Sprintf("Failed to create database %s on server: %v", newDB, err), http.StatusInternalServerError)
						return
					}
					// Also create user for the new database
					if a.Username != "" && a.Password != "" {
						err = sendInternalControlCommand(a.ServerID, agentService, "db_create_user", map[string]interface{}{
							"username": a.Username,
							"password": a.Password,
							"role":     a.Role,
							"target":   newDB,
						}, authToken)
						if err != nil {
							http.Error(w, fmt.Sprintf("Failed to create user for new database %s on server: %v", newDB, err), http.StatusInternalServerError)
							return
						}
					}
				}
			}

			// Update Privileges for all databases
			if a.Username != "" {
				for _, dbName := range allDBs {
					err := sendInternalControlCommand(a.ServerID, agentService, "db_update_privileges", map[string]interface{}{
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
				// Create exchanges, queues, and bindings
				for _, b := range a.Bindings {
					if b.VHost != "" {
						if b.SourceExchange != "" {
							err := sendInternalControlCommand(a.ServerID, "rabbitmq", "rabbitmq_create_exchange", map[string]interface{}{
								"vhost": b.VHost,
								"name":  b.SourceExchange,
								"type":  "topic",
							}, authToken)
							if err != nil {
								log.Printf("Warning: failed to create RabbitMQ exchange %s: %v", b.SourceExchange, err)
							}
						}
						if b.DestinationQueue != "" {
							err := sendInternalControlCommand(a.ServerID, "rabbitmq", "rabbitmq_create_queue", map[string]interface{}{
								"vhost": b.VHost,
								"name":  b.DestinationQueue,
							}, authToken)
							if err != nil {
								log.Printf("Warning: failed to create RabbitMQ queue %s: %v", b.DestinationQueue, err)
							}
						}
						if b.SourceExchange != "" && b.DestinationQueue != "" {
							err := sendInternalControlCommand(a.ServerID, "rabbitmq", "db_create_binding", map[string]interface{}{
								"vhost":            b.VHost,
								"sourceExchange":   b.SourceExchange,
								"destinationQueue": b.DestinationQueue,
								"routingKey":       b.RoutingKey,
							}, authToken)
							if err != nil {
								log.Printf("Warning: failed to create RabbitMQ binding: %v", err)
							}
						}
					}
				}

				// Sync bindings - return warning to user if sync fails
				err := sendInternalControlCommand(a.ServerID, "rabbitmq", "db_sync", map[string]interface{}{
					"bindings": a.Bindings,
				}, authToken)
				if err != nil {
					log.Printf("Warning: failed to sync RabbitMQ bindings: %v", err)
					// Return warning to user but don't fail the entire operation
					w.Header().Set("X-RabbitMQ-Warning", "Bindings sync failed: "+err.Error())
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
			err := sendInternalControlCommand(a.ServerID, a.PM2ProxyType, "proxy_create", map[string]interface{}{
				"domain": a.PM2ProxyDomain,
				"port":   float64(a.PM2Port),
			}, authToken)
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to configure PM2 reverse proxy: %v", err), http.StatusInternalServerError)
				return
			}
		}

		// Sync MQTT
		if a.Type == "mqtt-mosquitto" || a.Type == "mosquitto" {
			err := sendInternalControlCommand(a.ServerID, "mosquitto", "mq_create_user", map[string]interface{}{
				"username": a.Username,
				"password": a.Password,
			}, authToken)
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to create MQTT credentials: %v", err), http.StatusInternalServerError)
				return
			}
		}

		// Sync FTP - Use explicit mapping instead of string manipulation
		if a.Type == "ftp-vsftpd" || a.Type == "vsftpd" || a.Type == "ftp-sftpgo" || a.Type == "sftpgo" {
			// Explicit service type mapping for FTP services
			agentSvc := ""
			switch a.Type {
			case "ftp-vsftpd", "vsftpd":
				agentSvc = "vsftpd"
			case "ftp-sftpgo", "sftpgo":
				agentSvc = "sftpgo"
			}

			err := sendInternalControlCommand(a.ServerID, agentSvc, "ftp_create_user", map[string]interface{}{
				"username":  a.Username,
				"password":  a.Password,
				"root_path": a.RootPath,
			}, authToken)
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to provision FTP user: %v", err), http.StatusInternalServerError)
				return
			}
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
