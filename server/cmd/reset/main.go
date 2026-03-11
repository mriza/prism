package main

import (
	"log"
	"prism-server/internal/db"
	"prism-server/internal/models"
	"golang.org/x/crypto/bcrypt"
	"github.com/google/uuid"
)

func main() {
	if err := db.InitDB("/opt/prism/server/prism.db"); err != nil {
		log.Fatalf("Failed to init DB: %v", err)
	}

	username := "admin"
	password := "admin123"

	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	
	user, err := db.GetUserByUsername(username)
	if err != nil {
		log.Fatalf("Error checking user: %v", err)
	}

	if user == nil {
		newUser := models.User{
			ID:       uuid.New().String(),
			Username: username,
			Password: string(hash),
			Role:     "admin",
		}
		if _, err := db.CreateUser(newUser); err != nil {
			log.Fatalf("Failed to create admin: %v", err)
		}
		log.Printf("User '%s' created with password '%s'", username, password)
	} else {
		// Update password and ensure it's admin
		if err := db.UpdateUserPassword(user.ID, string(hash)); err != nil {
			log.Fatalf("Failed to update password: %v", err)
		}
		if err := db.UpdateUserRole(user.ID, "admin"); err != nil {
			log.Fatalf("Failed to update role: %v", err)
		}
		log.Printf("User '%s' updated with password '%s' and role 'admin'", username, password)
	}
}
