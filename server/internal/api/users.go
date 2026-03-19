package api

import (
	"encoding/json"
	"net/http"
	"prism-server/internal/db"
	"prism-server/internal/models"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func HandleUsers(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	origin := r.Header.Get("Origin")
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == "OPTIONS" {
		return
	}

	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		users, err := db.GetUsers()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Ensure we don't accidentally leak passwords (already omitempty/hidden typically, but just to be safe)
		for i := range users {
			users[i].Password = ""
		}

		json.NewEncoder(w).Encode(users)

	case "POST":
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
			FullName string `json:"fullName"`
			Email    string `json:"email"`
			Phone    string `json:"phone"`
			Role     string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		if req.Username == "" || req.Password == "" || req.Role == "" {
			http.Error(w, "Username, password and role are required", http.StatusBadRequest)
			return
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "Failed to hash password", http.StatusInternalServerError)
			return
		}

		user := models.User{
			Username: req.Username,
			Password: string(hashedPassword),
			FullName: req.FullName,
			Email:    req.Email,
			Phone:    req.Phone,
			Role:     req.Role,
		}

		u, err := db.CreateUser(user)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		user = u

		user.Password = ""
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(user)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func HandleUserDetail(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	origin := r.Header.Get("Origin")
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}
	w.Header().Set("Access-Control-Allow-Methods", "PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == "OPTIONS" {
		return
	}

	w.Header().Set("Content-Type", "application/json")

	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	id := pathParts[3]

	// Don't allow modified/deleted user if it's the last admin
	// Prevent self-deletion
	claims := GetUserClaims(r)
	if claims != nil && claims.UserID == id && r.Method == "DELETE" {
		http.Error(w, "Cannot delete your own account", http.StatusForbidden)
		return
	}

	switch r.Method {
	case "PUT":
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"` // optional
			FullName string `json:"fullName"`
			Email    string `json:"email"`
			Phone    string `json:"phone"`
			Role     string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		if req.Username == "" || req.Role == "" {
			http.Error(w, "Username and role are required", http.StatusBadRequest)
			return
		}

		var hashedPassword = ""
		if req.Password != "" {
			hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
			if err != nil {
				http.Error(w, "Failed to hash password", http.StatusInternalServerError)
				return
			}
			hashedPassword = string(hash)
		}

		user := models.User{
			ID:       id,
			Username: req.Username,
			Password: hashedPassword,
			FullName: req.FullName,
			Email:    req.Email,
			Phone:    req.Phone,
			Role:     req.Role,
		}

		if err := db.UpdateUser(user); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})

	case "DELETE":
		if err := db.DeleteUser(id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func HandleMe(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	origin := r.Header.Get("Origin")
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}
	w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == "OPTIONS" {
		return
	}

	w.Header().Set("Content-Type", "application/json")

	claims := GetUserClaims(r)
	if claims == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	switch r.Method {
	case "GET":
		user, err := db.GetUserByID(claims.UserID)
		if err != nil || user == nil {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		user.Password = ""
		json.NewEncoder(w).Encode(user)

	case "PUT":
		var req struct {
			Password string `json:"password"` // optional, for changing password
			FullName string `json:"fullName"`
			Email    string `json:"email"`
			Phone    string `json:"phone"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		user, err := db.GetUserByID(claims.UserID)
		if err != nil || user == nil {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}

		var hashedPassword = ""
		if req.Password != "" {
			hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
			if err != nil {
				http.Error(w, "Failed to hash password", http.StatusInternalServerError)
				return
			}
			hashedPassword = string(hash)
		}

		updatedUser := models.User{
			ID:       user.ID,
			Username: user.Username, // Username remains static
			Password: hashedPassword,
			FullName: req.FullName,
			Email:    req.Email,
			Phone:    req.Phone,
			Role:     user.Role, // Role remains static for self-update
		}

		if err := db.UpdateUser(updatedUser); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"success": true})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
