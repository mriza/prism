package db

import (
	"prism-server/internal/models"
	"testing"
)

func TestDeploymentOperations(t *testing.T) {
	// 1. Setup a project and an agent first
	proj := models.Project{
		Name: "Deployment Test Project",
	}
	projCreated, err := CreateProject(proj)
	if err != nil {
		t.Fatalf("Failed to create project: %v", err)
	}
	defer DeleteProject(projCreated.ID)

	server := models.Server{
		Name:     "Test Server for Deployment",
		Hostname: "test-host-dep",
	}
	serverCreated, err := CreateServer(server)
	if err != nil {
		t.Fatalf("Failed to create server: %v", err)
	}
	defer DeleteServer(serverCreated.ID)

	// 2. Test Create
	dep := models.Deployment{
		Name:      "Test App",
		ProjectID: projCreated.ID,
		ServerID:  serverCreated.ID,
		SourceURL: "https://github.com/example/test-app",
		Status:    "stopped",
	}

	created, err := CreateDeployment(dep)
	if err != nil {
		t.Fatalf("Failed to create deployment: %v", err)
	}
	if created.ID == "" {
		t.Error("Expected ID to be populated")
	}

	// 3. Test Get
	deps, err := GetDeployments(DeploymentFilters{ProjectID: projCreated.ID})
	if err != nil {
		t.Fatalf("Failed to get deployments: %v", err)
	}
	if len(deps) == 0 {
		t.Error("Expected at least one deployment")
	}

	// 4. Test Update
	created.Status = "active"
	err = UpdateDeployment(created)
	if err != nil {
		t.Fatalf("Failed to update deployment: %v", err)
	}

	deps, _ = GetDeployments(DeploymentFilters{ProjectID: projCreated.ID})
	found := false
	for _, d := range deps {
		if d.ID == created.ID && d.Status == "active" {
			found = true
			break
		}
	}
	if !found {
		t.Error("Updated deployment not found or status not updated")
	}

	// 5. Test Delete
	err = DeleteDeployment(created.ID)
	if err != nil {
		t.Fatalf("Failed to delete deployment: %v", err)
	}

	deps, _ = GetDeployments(DeploymentFilters{ProjectID: projCreated.ID})
	for _, d := range deps {
		if d.ID == created.ID {
			t.Error("Expected deployment to be deleted")
		}
	}
}
