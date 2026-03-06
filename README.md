# Fitz Infrastructure Manager

Fitz is a modular infrastructure management system designed to manage distributed services (MySQL, RabbitMQ, Caddy, Nginx, MinIO, etc.) across multiple servers from a centralized dashboard.

## Architecture

The system follows a Hub-and-Spoke architecture:

-   **Server (Hub)**: The central control plane. It manages agent connections via WebSocket and exposes a REST API for the frontend.
-   **Agent (Spoke)**: Runs on each managed server. It detects and manages local services (systemd, pm2, docker, etc.) and connects primarily to the Hub.
-   **Frontend**: A React-based dashboard that connects to the Hub to visualize and control the infrastructure.

## Project Structure

-   `agent/`: Go module for the agent service.
-   `server/`: Go module for the central hub server.
-   `frontend/`: React application (Vite) for the dashboard.

## Getting Started

### Prerequisites

-   Go 1.21+
-   Node.js 18+
-   MySQL / PostgreSQL (optional, for specific modules)
-   RabbitMQ (optional, for specific modules)

### Running the Server (Hub)

```bash
cd server
go run cmd/server/main.go
# Server listens on :65432
```

### Running the Agent

```bash
cd agent
# Copy example config
cp fitz-agent.conf.example fitz-agent.conf
# Run agent
go run cmd/agent/index.go -config fitz-agent.conf
```

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
# Dashboard available at http://localhost:5173
```

## Features

-   **Service Management**: Start/Stop/Restart services via Systemd or PM2.
-   **Database Management**: Manage MySQL/PostgreSQL users and privileges.
-   **RabbitMQ Management**: Manage VHosts, Users, and Bindings.
-   **Web Server Management**: Manage Caddy/Nginx sites.
-   **Object Storage**: Manage S3 buckets (MinIO/Garage/SeaweedFS).
