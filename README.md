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

## 📖 How to Use This Guide

**This README provides educational guidance without showing full commands.** Your task is to research and construct the actual Docker commands based on the descriptions provided. All complete command examples are available in [README_FULL.md](README_FULL.md) if you need to verify your work or get unstuck.

This approach encourages hands-on learning and helps you understand what each Docker command does, rather than just copying and pasting.

---

## Getting the Repository

### Option 1 – Git Clone (recommended)

If you have Git installed, clone the repository from GitHub to your local machine.

### Option 2 – Download as ZIP (Windows/macOS without Git)

If you don't have Git installed:

1. **On Windows with winget:** Install the unzip tool using your package manager if needed
2. **Download the repository:** Visit the GitHub repository and download it as a ZIP file, or use a
   command-line tool to download the ZIP from the repository's archive URL
3. **Extract the ZIP:** Use your unzip tool to extract the downloaded file
4. **Navigate:** Change into the extracted directory

---

## Option A – Docker CLI (no Compose)

This workflow uses raw `docker` commands. For detailed command examples, see [README_FULL.md](README_FULL.md).

This workflow teaches you how Docker works by running commands individually, so you can see exactly what each step does.

### Step 1 – Create your environment file

Copy `.env.example` to `.env` and review the credentials. The file contains database passwords and
the application port. These values flow into each container at runtime via `-e` flags so they never
get baked into an image layer.

### Step 2 – Create a shared Docker network

Create a network that allows your containers to communicate with each other by name. This isolates
them from other containers and the host system.

### Step 3 – Build the backend image

Build the Docker image for the Python/FastAPI backend. Use the `Dockerfile` in the `backend/`
directory. Because `requirements.txt` is copied before the application source, the expensive
`pip install` step is skipped on subsequent builds whenever only app code changes.

### Step 4 – Build the frontend image

Build the Docker image for the Nginx frontend. Use the `Dockerfile` in the `frontend/` directory.
The static files and Nginx configuration should be baked into the image at build time.

### Step 5 – Start the database container

Run the MySQL 8 container. No Dockerfile is required — Docker pulls the official `mysql:8.0` image.
The following is already configured and provided — you only need to add the container name, the two
volume mounts (bind mounts), and the image:

Pre-configured network and environment settings:
```
--network dostuff-net \
--network-alias db \
--restart unless-stopped \
-e MYSQL_ROOT_PASSWORD=<value from .env> \
-e MYSQL_DATABASE=<value from .env> \
-e MYSQL_USER=<value from .env> \
-e MYSQL_PASSWORD=<value from .env> \
```

**Your task:** Construct a `docker run` command that combines:
- Detached mode (`-d` flag)
- The container name: `dostuff-db`
- The pre-configured settings above
- Two bind mounts:
  - `./mysql/init` → `/docker-entrypoint-initdb.d` (init SQL scripts)
  - `./data/mysql` → `/var/lib/mysql` (persistent data)
- The image: `mysql:8.0`

> **Wait for MySQL:** MySQL needs about 30–60 seconds to initialise on first start. Wait until
> `docker inspect --format '{{.State.Health.Status}}' dostuff-db` returns `healthy` before proceeding.

Consult [README_FULL.md](README_FULL.md) for a complete example if needed.

### Step 6 – Start the backend container

Run the backend container. For reference, use the suggested container name `dostuff-backend` and the
image you built in Step 3. The following is already configured and provided — you only need to add
the container name and the image:

Pre-configured network and environment settings:
```
--network dostuff-net \
--network-alias backend \
--restart unless-stopped \
-e DB_HOST=dostuff-db \
-e DB_PORT=3306 \
-e DB_NAME=<value from .env> \
-e DB_USER=<value from .env> \
-e DB_PASSWORD=<value from .env> \
```

**Your task:** Construct a `docker run` command that combines:
- Detached mode (`-d` flag)
- The container name: `dostuff-backend`
- The pre-configured settings above
- The image name from Step 3

Consult [README_FULL.md](README_FULL.md) for a complete example if needed.

### Step 7 – Start the frontend container

Run the frontend container with:
- Detached mode
- A container name
- Network attachment (same network as the backend)
- Port mapping (80 on host → 80 in container)
- Restart policy

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

For detailed command examples, see [README_FULL.md](README_FULL.md).

Compose manages the entire multi-container application from a single `docker-compose.yml` file.
Instead of running individual `docker` commands, Compose handles network creation, dependency ordering,
volume mounts, and full lifecycle control with simple commands.

### Step 1 – Create your environment file

Copy `.env.example` to `.env` and review the credentials. Compose automatically reads `.env` from
the project directory and substitutes its variables into `docker-compose.yml` (e.g. `${MYSQL_PASSWORD}`),
so your credentials flow into the containers without ever appearing in the Compose file itself.

### Step 2 – Build all images

Use the Docker Compose build command to read the build context and Dockerfile for each service
defined in `docker-compose.yml` and build them. Docker's layer cache applies here too, so repeated
builds are fast. You can also build individual services if needed.

### Step 3 – Start all services

Use the Docker Compose up command with the detached flag. Compose will automatically:

1. Create the `app-network` bridge network declared in `docker-compose.yml`
2. Start `db` first and wait for its health check to pass
3. Start `backend` once `db` is healthy, and wait for the backend health check
4. Start `frontend` once `backend` is healthy, publishing the host port

### Combined build + start

You can also combine build and start into a single command using the build flag with the up command.
Use this whenever you change application code and want to rebuild and restart without separate commands.

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
