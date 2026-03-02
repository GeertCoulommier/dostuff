# DoStuff — Full Command Reference

This document lists every command you'll need to work with the project.

---

## Prerequisites

```bash
docker --version      # Docker 24+
docker compose version  # Compose v2+
python3 --version     # Only needed to run tests locally
```

---

## Setup

### 1. Copy and configure environment

```bash
cp .env.example .env
# Edit .env to change credentials or ports
```

### 2. Build and start

```bash
docker compose up --build -d
```

### 3. Verify services are healthy

```bash
docker compose ps
# All three services should show "healthy"
```

### 4. View logs

```bash
docker compose logs -f          # All services
docker compose logs -f backend  # Backend only
docker compose logs -f db       # MySQL only
```

---

## Using the App

Open `http://localhost` in your browser.

Or use the auto-generated API docs: `http://localhost/api/docs`

---

## API Endpoints

### Health

```bash
curl http://localhost/api/health
# {"status":"ok","timestamp":"..."}
```

### List all tasks

```bash
curl http://localhost/api/tasks
```

### Create a task

```bash
curl -X POST http://localhost/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy groceries","priority":"medium","deadline":"2025-12-31"}'
```

### Get a single task

```bash
curl http://localhost/api/tasks/1
```

### Update a task

```bash
curl -X PUT http://localhost/api/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy groceries and cook","priority":"high","completed":true}'
```

### Delete a task

```bash
curl -X DELETE http://localhost/api/tasks/1
# 204 No Content
```

---

## Running Tests

### Locally (no Docker needed)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest tests/ -v
pytest tests/ -v --cov=app --cov-report=term-missing
```

### Inside the running container

```bash
docker compose exec backend pytest tests/ -v
```

---

## Stopping & Cleaning Up

```bash
# Stop (keep volumes)
docker compose down

# Stop and remove named volumes + images
docker compose down --rmi all --volumes

# Remove MySQL data directory (WARNING: deletes all tasks)
rm -rf ./data/mysql
```

---

## Rebuilding After Code Changes

```bash
# Rebuild only the backend
docker compose up --build -d backend

# Rebuild everything
docker compose up --build -d
```

---

## Inspecting the Database

```bash
# Open a MySQL shell
docker compose exec db mysql -u dostuff -pdostuffsecret dostuff

# Inside MySQL shell:
SHOW TABLES;
SELECT * FROM tasks;
DESCRIBE tasks;
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `db` container not healthy | Wait 30 s for MySQL to initialise |
| `backend` exits immediately | Check `docker compose logs backend` — MySQL may still be starting |
| Port 80 conflict | Set `APP_PORT=8080` in `.env` then `docker compose up -d` |
| Data lost after `down` | Use `docker compose down` (without `--volumes`) |
| Init script didn't run | Delete `./data/mysql/` and restart |
