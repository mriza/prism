package main

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	password := "admin123"
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	fmt.Printf("Hash: %s\n", string(hash))

	err := bcrypt.CompareHashAndPassword(hash, []byte(password))
	if err != nil {
		fmt.Println("Comparison FAILED")
	} else {
		fmt.Println("Comparison SUCCESS")
	}
}
