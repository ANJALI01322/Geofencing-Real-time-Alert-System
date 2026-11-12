# 🌍 GeoTrack — Geofencing & Real-Time Vehicle Alert System

A production-grade full-stack application for real-time vehicle tracking, geofence management, and automated violation alerts — built for the **MapUp Full-Stack Developer Assessment**.

![Tech Stack](https://img.shields.io/badge/Backend-Go-00ADD8?logo=go) ![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react) ![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql) ![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?logo=docker)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🚗 **Vehicle Management** | Add, track, and update vehicles with real-time GPS location |
| 🗺️ **Geofence Builder** | Draw custom polygon geofences on an interactive Leaflet map |
| ⚡ **Real-Time WebSocket** | Live vehicle position updates via WebSocket hub |
| 🚨 **Violation Detection** | Ray-casting algorithm detects when vehicles enter/exit geofences |
| 📊 **Dashboard** | Live stats — active vehicles, geofences, recent violations |
| 🔔 **Alert Configuration** | Per-rule alerts with entry/exit/speed triggers |
| 📜 **Violation History** | Filterable log of all geofence violations |
| 🌐 **Live Tracking** | Real-time map showing all vehicles with location simulation |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│           React Frontend            │
│  Vite + Tailwind + React-Leaflet    │
│  Glassmorphism Dark UI              │
└──────────────┬──────────────────────┘
               │ HTTP REST + WebSocket
┌──────────────▼──────────────────────┐
│           Go Backend                │
│  gorilla/mux + gorilla/websocket    │
│  Ray-Casting Geofence Detection     │
│  WebSocket Hub (real-time)          │
└──────────────┬──────────────────────┘
               │ lib/pq
┌──────────────▼──────────────────────┐
│          PostgreSQL 16              │
│  JSONB polygon coordinates          │
│  UUID primary keys                  │
│  Auto-update triggers               │
└─────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac/Linux)
- Git

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd geotrack
```

### 2. Start the backend (Go + PostgreSQL)
```bash
docker compose up --build -d
```

The backend starts at `http://localhost:8080`. PostgreSQL runs internally — no host port needed.

### 3. Start the frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend starts at `http://localhost:5173`.

### 4. Open the app
Navigate to [http://localhost:5173](http://localhost:5173)

---

## 📡 API Endpoints

### Vehicles
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/vehicles` | List all vehicles |
| `POST` | `/vehicles` | Create a vehicle |
| `POST` | `/vehicles/location` | Update vehicle GPS location |
| `GET` | `/vehicles/location/:id` | Get latest vehicle location |

### Geofences
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/geofences` | List all geofences (optional `?category=`) |
| `POST` | `/geofences` | Create a polygon geofence |

### Alerts & Violations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/alerts/configure` | Configure alert rules |
| `GET` | `/alerts` | List alert configurations |
| `GET` | `/violations/history` | Get violation history |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `ws://localhost:8080/ws` | Real-time vehicle location stream |

---

## 🛠️ Tech Stack

### Backend
- **Go 1.21** — compiled, high-performance API server
- **gorilla/mux** — HTTP router
- **gorilla/websocket** — WebSocket hub for real-time updates
- **lib/pq** — PostgreSQL driver
- **Ray-Casting Algorithm** — point-in-polygon geofence detection

### Frontend
- **React 18** + **Vite** — fast dev + optimized build
- **Tailwind CSS** — utility-first styling
- **React-Leaflet** — interactive maps with polygon drawing
- **Axios** — HTTP client with request/response interceptors
- **React Hot Toast** — notification system
- **Lucide React** — icon library
- **date-fns** — date formatting

### Infrastructure
- **PostgreSQL 16** (Alpine) — relational DB with JSONB for polygon coords
- **Docker Compose** — multi-service orchestration with health checks

---

## 📁 Project Structure

```
geotrack/
├── backend/
│   ├── main.go              # Entry point, router, WebSocket hub
│   ├── handlers/            # HTTP handler functions
│   ├── models/              # DB models & queries
│   ├── migrations/          # SQL schema migrations
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, Vehicles, Geofences, etc.
│   │   ├── api/             # Axios API client
│   │   ├── components/      # Reusable UI components
│   │   └── App.jsx          # Router + layout
│   ├── index.html
│   └── package.json
├── docker-compose.yml       # Postgres + Backend services
└── README.md
```

---

## 🔧 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `host=postgres port=5432 user=postgres password=postgres dbname=geotrack sslmode=disable` | PostgreSQL connection string |
| `PORT` | `8080` | Backend server port |

---

## 🧠 Key Design Decisions

### Ray-Casting Algorithm
Geofence violation detection uses the **ray-casting algorithm** to determine if a GPS coordinate falls inside a polygon:
```go
// Cast a horizontal ray from the point and count polygon edge intersections
// Odd intersections = inside polygon
```

### WebSocket Hub
A centralized Go `Hub` struct manages all connected WebSocket clients, enabling O(1) broadcast when a vehicle location is updated.

### JSONB Polygon Storage
Geofence coordinates are stored as PostgreSQL JSONB arrays, allowing flexible polygon shapes without a fixed schema.

### Docker Network Isolation
Services communicate over a private `geotrack_net` bridge network — PostgreSQL is never exposed to the host.

---

## 🤝 Collaborators

This project was submitted as part of the **MapUp Full-Stack Developer Assessment**.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
