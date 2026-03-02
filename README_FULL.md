# DoStuff – Docker Build Demo

A task-manager web application that demonstrates building and running Docker containers. The app lets
you create, view, update, and delete tasks with title, priority level, and deadline — all backed by a
MySQL database and served through an Nginx reverse proxy.

> **⚠️ Disclaimer:** This project was built with AI assistance (GitHub Copilot / Claude). It is
> intended solely as a Docker learning exercise. The application code — including the FastAPI backend,
> Nginx configuration, and frontend JavaScript — is **not** intended as a reference implementation or
> production-ready example. Do not use it as a template for real-world projects without thorough review.

## Features

- **Full CRUD API** – Create, Read, Update, and Delete tasks via REST endpoints
- **Task fields** – title, priority level (low / medium / high), deadline, and completed flag
- **MySQL 8** database with automatic schema initialisation on first start
- **FastAPI** backend with automatic OpenAPI docs at `/api/docs`
- **Filtering** – filter tasks by status (pending / done) and priority level
- **Two bind volumes** – one for MySQL init scripts, one for persistent data
- **Rate limiting** – 10 req/s at the Nginx reverse-proxy layer
- **Health checks** on all three services with a strict dependency chain
- **Non-root user** in every container
- **CI/CD pipeline** – GitHub Actions: tests → audit → Docker builds → container smoke test
- **CodeQL** security analysis

## Architecture

```
┌──────────────┐       ┌────────────────────┐       ┌─────────────────┐
│   Browser    │──────>│  Nginx (frontend)  │──────>│  FastAPI        │
│              │  :80  │  Static files +    │ :8000 │  Task CRUD      │
│              │<──────│  Reverse proxy     │<──────│  (SQLAlchemy)   │
└──────────────┘       └────────────────────┘       └────────┬────────┘
                                                             │
                                                    ┌────────┴────────┐
                                                    │    MySQL 8      ├──── ./mysql/init   (bind vol 1)
                                                    │    :3306        ├──── ./data/mysql   (bind vol 2)
                                                    └─────────────────┘
```

- **Frontend** – Nginx serves static HTML/CSS/JS and reverse-proxies `/api/*` to the backend
- **Backend** – FastAPI handles all task CRUD operations via SQLAlchemy ORM
  - **Rate limiting** – 10 req/s at the Nginx layer
  - **Health check** – `/api/health` polled by Docker and Nginx
  - **OpenAPI docs** – auto-generated interactive docs at `/api/docs`
- **Database** – MySQL 8 with schema applied from `mysql/init/init.sql` on first start

## API Reference

`GET /api/tasks` – optional query parameters:

| Parameter   | Type    | Description                        | Example    |
|-------------|---------|------------------------------------|------------|
| `completed` | boolean | Filter by completion state         | `true`     |
| `priority`  | string  | Filter by priority level           | `high`     |

Other endpoints:

| Endpoint               | Method   | Description                                  |
|------------------------|----------|----------------------------------------------|
| `POST /api/tasks`      | Create   | Create a new task                            |
| `GET /api/tasks/{id}`  | Read     | Get a single task by ID                      |
| `PUT /api/tasks/{id}`  | Update   | Update title, priority, deadline, completed  |
| `DELETE /api/tasks/{id}` | Delete | Delete a task (returns 204 No Content)       |
| `GET /api/health`      | Health   | Health check                                 |

## CI/CD

| Workflow   | Trigger                  | What it does |
|------------|--------------------------|------------------------------------------|
| **CI**     | push / PR → `main`       | Install → pytest + coverage → `pip-audit` → Docker image builds → Container health smoke test |
| **CodeQL** | push / PR / weekly       | Static security analysis of all Python |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed (for the Compose workflow)

> **Port 80:** Both workflows expose the app on port 80. If another process is already using port 80
> on your machine, replace `80:80` with an alternative like `8080:80` and access via
> `http://localhost:8080`.

> **Accessing the app:** The URLs in this guide use `localhost`, which works when your browser runs
> on the same machine as Docker. If Docker is running on a remote server or VM, replace `localhost`
> with the hostname or IP address of that machine — for example `http://192.168.1.50` or
> `http://myserver.local`.

---

## Getting the Repository

### Option 1 – Git Clone (recommended)

If you have Git installed:

```bash
git clone https://github.com/GeertCoulommier/dostuff.git
cd dostuff
```

This clones the entire repository with full version history.

### Option 2 – Download as ZIP (Windows/macOS without Git)

If you don't have Git installed, you can download and extract the repository:

#### On Windows with winget:

```bash
# Install unzip (if not already installed)
winget install -q GnuWin32.UnZip

# Download the repository as ZIP
# Visit https://github.com/GeertCoulommier/dostuff/archive/refs/heads/main.zip
# and extract it manually, or use:
curl -L https://github.com/GeertCoulommier/dostuff/archive/refs/heads/main.zip -o dostuff.zip
unzip -q dostuff.zip
cd dostuff-main
```

#### On macOS/Linux without Git:

```bash
curl -L https://github.com/GeertCoulommier/dostuff/archive/refs/heads/main.zip -o dostuff.zip
unzip -q dostuff.zip
cd dostuff-main
```

---

## Option A – Docker CLI (no Compose)

This workflow uses raw `docker` commands so you can see exactly what each step does.

### Step 1 – Create your environment file

```bash
cp .env.example .env
# Review .env and change credentials if desired
```

The `.env` file stores database credentials and the application port outside of any image or code.
Values are passed into each container at runtime via `-e` flags so they never get baked into an
image layer.

### Step 2 – Create a shared Docker network

```bash
docker network create dostuff-net
```

Containers cannot talk to each other by name unless they share the same network. This creates an
isolated bridge network. Services on it can reach each other using their container name or alias as
a hostname. Nothing outside this network can initiate connections to them.

### Step 3 – Build the backend image

```bash
docker build -t dostuff-backend ./backend
```

Docker reads `backend/Dockerfile`, executes each `RUN`/`COPY` instruction as a cacheable layer, and
tags the result `dostuff-backend:latest`. Because `requirements.txt` is copied before the application
source, the expensive `pip install` step is skipped on subsequent builds whenever only app code changes.

### Step 4 – Build the frontend image

```bash
docker build -t dostuff-frontend ./frontend
```

Same process for the Nginx image. The static files (HTML/CSS/JS) and the custom `nginx.conf`
(which includes the `/api/` reverse-proxy rule and rate-limiting zone) are baked into the image at
build time.

### Step 5 – Start the database container

```bash
docker run -d \
  --name dostuff-db \
  --network dostuff-net \
  --network-alias db \
  --restart unless-stopped \
  -e MYSQL_ROOT_PASSWORD=$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2) \
  -e MYSQL_DATABASE=$(grep MYSQL_DATABASE .env | cut -d= -f2) \
  -e MYSQL_USER=$(grep MYSQL_USER .env | cut -d= -f2) \
  -e MYSQL_PASSWORD=$(grep MYSQL_PASSWORD .env | cut -d= -f2) \
  -v "$(pwd)/mysql/init:/docker-entrypoint-initdb.d" \
  -v "$(pwd)/data/mysql:/var/lib/mysql" \
  mysql:8.0
```

What each flag does:

| Flag | Purpose |
|------|---------|
| `-d` | Run in the background (detached mode) |
| `--name dostuff-db` | Give the container a human-readable name for subsequent commands |
| `--network dostuff-net` | Attach it to the shared bridge network |
| `--network-alias db` | Register the DNS name `db` inside the network |
| `--restart unless-stopped` | Automatically restart after a crash or a Docker daemon restart |
| `-e MYSQL_ROOT_PASSWORD=...` | Root password for MySQL administration |
| `-e MYSQL_DATABASE=...` | Database name to create on first start |
| `-e MYSQL_USER=...` | Application user to create |
| `-e MYSQL_PASSWORD=...` | Application user password |
| `-v "$(pwd)/mysql/init:/docker-entrypoint-initdb.d"` | Bind-mount init SQL scripts; executed on first start |
| `-v "$(pwd)/data/mysql:/var/lib/mysql"` | Bind-mount MySQL data directory for persistence |

No port is published to the host (`-p` is absent). The database is intentionally reachable only
through the internal network.

> **Wait for MySQL:** MySQL needs about 30–60 seconds to initialise on first start. Wait until
> the container is healthy before starting the backend:
>
> ```bash
> docker inspect --format '{{.State.Health.Status}}' dostuff-db
> # Wait for output: healthy
> ```

### Step 6 – Start the backend container

```bash
docker run -d \
  --name dostuff-backend \
  --network dostuff-net \
  --network-alias backend \
  --restart unless-stopped \
  -e DB_HOST=dostuff-db \
  -e DB_PORT=3306 \
  -e DB_NAME=$(grep MYSQL_DATABASE .env | cut -d= -f2) \
  -e DB_USER=$(grep MYSQL_USER .env | cut -d= -f2) \
  -e DB_PASSWORD=$(grep MYSQL_PASSWORD .env | cut -d= -f2) \
  dostuff-backend
```

What each flag does:

| Flag | Purpose |
|------|---------|
| `-d` | Run in the background (detached mode) |
| `--name dostuff-backend` | Give the container a human-readable name for subsequent commands |
| `--network dostuff-net` | Attach it to the shared bridge network |
| `--network-alias backend` | Register the DNS name `backend` inside the network — Nginx resolves this hostname to forward API requests |
| `--restart unless-stopped` | Automatically restart after a crash or a Docker daemon restart |
| `-e DB_HOST=dostuff-db` | Tell FastAPI which hostname to connect to (the db container name) |
| `-e DB_PORT=3306` | MySQL port inside the container |
| `-e DB_NAME=...` | Database name |
| `-e DB_USER=...` | Application user |
| `-e DB_PASSWORD=...` | Application user password |

No port is published to the host (`-p` is absent). The backend is intentionally reachable only
through the internal network — all external traffic must go through Nginx.

### Step 7 – Start the frontend container

```bash
docker run -d \
  --name dostuff-frontend \
  --network dostuff-net \
  --restart unless-stopped \
  -p 80:80 \
  dostuff-frontend
```

| Flag | Purpose |
|------|---------|
| `-p 80:80` | Map host port 80 → container port 80, making Nginx reachable from the browser |
| `--network dostuff-net` | Same shared network, so Nginx can DNS-resolve the `backend` alias |

Open **http://localhost** in your browser.

---

### Useful Commands (Docker CLI)

#### View logs

```bash
# Follow live logs for a container (Ctrl-C to stop)
docker logs -f dostuff-db
docker logs -f dostuff-backend
docker logs -f dostuff-frontend

# Show only the last 50 lines
docker logs --tail 50 dostuff-backend
```

Uvicorn (backend) and Nginx (frontend) log every request. Watching both helps you trace the full
path of a request and spot errors from either layer.

#### Check container status and health

```bash
# List running containers with ports and health status
docker ps

# Inspect the health-check result specifically
docker inspect --format '{{.State.Health.Status}}' dostuff-db
docker inspect --format '{{.State.Health.Status}}' dostuff-backend
docker inspect --format '{{.State.Health.Status}}' dostuff-frontend
```

The `HEALTHCHECK` instructions in the Dockerfiles and the mysqladmin ping command periodically poll
each service. Docker marks a container `healthy`, `unhealthy`, or `starting` accordingly.

#### Open a shell inside a container

```bash
docker exec -it dostuff-backend sh
docker exec -it dostuff-frontend sh
```

Useful for debugging — inspect files, run one-off commands, or check environment variables with
`printenv`.

#### Inspect the database

```bash
# Open a MySQL shell inside the running db container
docker exec -it dostuff-db mysql -u dostuff -pdostuffsecret dostuff

# Inside the MySQL shell:
SHOW TABLES;
SELECT * FROM tasks;
DESCRIBE tasks;
```

#### Stop and remove the containers

```bash
# Stop all containers gracefully (SIGTERM → SIGKILL after timeout)
docker stop dostuff-frontend dostuff-backend dostuff-db

# Remove the stopped containers (frees the names for next run)
docker rm dostuff-frontend dostuff-backend dostuff-db

# Remove the network
docker network rm dostuff-net
```

Stop the frontend first so Nginx is no longer accepting new requests before the backend disappears.

#### Rebuild after code changes

```bash
# Rebuild images (unchanged layers are served from cache)
docker build -t dostuff-backend ./backend
docker build -t dostuff-frontend ./frontend

# Replace the running containers
docker stop dostuff-frontend dostuff-backend
docker rm   dostuff-frontend dostuff-backend

# Re-run steps 6 & 7
```

> **Note:** The database container (`dostuff-db`) does not need to be rebuilt after code changes —
> only the backend and frontend images change when application code is updated.

---

## Option B – Docker Compose

Compose manages the entire multi-container application from a single `docker-compose.yml` file. It
handles network creation, dependency ordering, volume mounts, and full lifecycle control — replacing
all the individual `docker` commands above with single-line shortcuts.

### Step 1 – Create your environment file

```bash
cp .env.example .env
# Review .env and change credentials if desired
```

Compose automatically reads `.env` from the project directory and substitutes its variables into
`docker-compose.yml` (e.g. `${MYSQL_PASSWORD}`), so your credentials flow into the containers
without ever appearing in the Compose file itself.

### Step 2 – Build all images

```bash
docker compose build
```

Reads the `build.context` and `build.dockerfile` for every service in `docker-compose.yml` and
builds them. Docker's layer cache is used exactly as with the manual `docker build` commands, so
repeated builds are fast. To rebuild a single service only:

```bash
docker compose build backend
```

### Step 3 – Start all services

```bash
docker compose up -d
```

Compose performs these steps automatically:

1. Creates the `app-network` bridge network declared in `docker-compose.yml`
2. Starts `db` first and waits for the mysqladmin health check to pass (up to 40 s)
3. Starts `backend` once `db` is healthy, and waits for the `/api/health` check to pass
4. Starts `frontend` once `backend` is healthy, publishing the host port

The `-d` flag (detached) returns control to your terminal. Without it Compose streams all logs to
stdout and blocks until you press Ctrl-C.

Open **http://localhost** in your browser.

### Combined build + start

```bash
docker compose up --build -d
```

Equivalent to running `build` then `up -d` in one step. Use this whenever you change application
code and want to rebuild and restart without separate commands.

---

### Useful Commands (Docker Compose)

#### View logs

```bash
# Follow all services at once (colour-coded by service name)
docker compose logs -f

# Follow a single service
docker compose logs -f backend

# Show the last 100 lines from all services
docker compose logs --tail 100
```

Interleaved, colour-coded output makes it easy to trace a request as it flows from Nginx → FastAPI
→ MySQL and back.

#### Check container status and health

```bash
# Show all service containers, their status, and exposed ports
docker compose ps

# Detailed health-check state (uses the full container name from docker compose ps)
docker inspect --format '{{.State.Health.Status}}' dostuff-db
docker inspect --format '{{.State.Health.Status}}' dostuff-backend
docker inspect --format '{{.State.Health.Status}}' dostuff-frontend
```

#### Open a shell inside a service container

```bash
docker compose exec backend sh
docker compose exec frontend sh
```

Compose resolves the service name to the correct container automatically — no need to remember the
full container name.

#### Inspect the database

```bash
# Open a MySQL shell inside the db service container
docker compose exec db mysql -u dostuff -pdostuffsecret dostuff

# Inside the MySQL shell:
SHOW TABLES;
SELECT * FROM tasks;
DESCRIBE tasks;
```

#### Stop containers (keep images and volumes)

```bash
docker compose stop
```

Gracefully stops all containers without removing them or the network. Use `docker compose start` to
bring them back up instantly (no rebuild required).

#### Stop and remove everything

```bash
docker compose down
```

Stops and removes the containers and the network. Images are retained so a subsequent
`docker compose up -d` is fast.

To also remove the images:

```bash
docker compose down --rmi all
```

> **Warning:** Adding `--volumes` will also remove any Docker-managed named volumes. This project
> uses bind mounts, so MySQL data lives in `./data/mysql/` on the host and is **not** removed by
> `--volumes`. Delete it manually with `rm -rf ./data/mysql` only if you want a completely clean slate.

#### Rebuild after code changes

```bash
docker compose up --build -d
```

Compose rebuilds only the images whose source has changed (Docker layer cache), then recreates the
affected containers in-place. Services with unchanged images are left running.

---

## Running Tests

### Locally (no Docker or MySQL needed)

The test suite uses an in-memory SQLite database — no MySQL instance is required.

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
pytest tests/ -v --cov=app --cov-report=term-missing
```

### Inside the running backend container

```bash
docker compose exec backend pytest tests/ -v
# or with Docker CLI:
docker exec -it dostuff-backend pytest tests/ -v
```

---

## Project Structure

```
dostuff/
├── docker-compose.yml        # Orchestrates all three services + bind mounts
├── .env.example              # Template for environment variables
├── .env                      # Your secrets (git-ignored)
├── .gitignore
├── README.md                 # Quick-start guide (simplified instructions)
├── README_FULL.md            # Complete guide with full command examples
├── mysql/
│   └── init/
│       └── init.sql          # Schema applied on first container start
├── data/
│   └── mysql/                # MySQL data directory (created at runtime, git-ignored)
├── backend/
│   ├── Dockerfile            # Python 3.12 Alpine image
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── pyproject.toml        # pytest path configuration
│   ├── app.py                # FastAPI application with CRUD endpoints
│   └── tests/
│       └── test_app.py       # pytest suite (24 tests, SQLite in-memory)
└── frontend/
    ├── Dockerfile            # Nginx Alpine image
    ├── .dockerignore
    ├── nginx.conf            # Reverse proxy + rate limiting config
    ├── index.html
    ├── css/
    │   └── styles.css
    └── js/
        └── app.js            # Vanilla JS CRUD with filter bar and edit modal
```

---

## Key Docker Concepts Demonstrated

| Concept | Where |
|---------|-------|
| Multi-service orchestration | `docker-compose.yml` |
| Custom build contexts | `backend/Dockerfile`, `frontend/Dockerfile` |
| Environment variables | `.env` → `docker-compose.yml` / `-e` flag → container |
| Inter-container networking | `app-network` bridge, `proxy_pass http://backend:8000` |
| Network aliases | `--network-alias backend` (CLI) / service name (Compose) |
| Bind-mount volumes (×2) | `./mysql/init` → init scripts; `./data/mysql` → persistent data |
| Health-check dependency chain | `db` healthy → `backend` starts → `backend` healthy → `frontend` starts |
| Health checks | `HEALTHCHECK` in Dockerfiles + mysqladmin ping for `db` |
| Non-root user | Backend runs as `appuser`; Nginx drops privileges automatically |
| Layer caching optimisation | `COPY requirements.txt` before `COPY .` |
| `.dockerignore` | Keeps test files and cache out of the build context |
| Internal-only services | `db` and `backend` have no published ports; reachable only via the internal network |
