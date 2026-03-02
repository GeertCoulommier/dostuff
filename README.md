# DoStuff - Task Manager

> **Note:** This project was built for practising Docker. It is not intended for production use.

A containerised to-do / task-management application built with **Python (FastAPI)**, **MySQL**, and **Nginx**. This is the third app in a Docker learning series — following [AgeDiff](https://github.com/GeertCoulommier/agediff) and [CineSearch](https://github.com/GeertCoulommier/cinesearch).

---

## Features

- Full **CRUD** API (Create, Read, Update, Delete) for tasks
- Tasks track **title**, **priority level** (low / medium / high) and **deadline**
- **MySQL 8** database with persistent bind-mounted volume
- **FastAPI** backend with automatic OpenAPI docs (`/docs`)
- Lightweight **Nginx** frontend in vanilla JS with a fresh, colourful design
- Docker bind volumes for MySQL data **and** init scripts
- Health checks on all three services
- Non-root user in every container
- GitHub Actions CI/CD pipeline with automated tests and smoke tests
- CodeQL security analysis

---

## Architecture

```
 Browser
    │  port 80 (configurable via APP_PORT)
    ▼
┌──────────┐      /api/*       ┌──────────────┐
│  Nginx   │ ──────────────▶  │  FastAPI     │
│ (frontend│                  │  Python 3.12 │
│  :80)    │                  │  (:8000)     │
└──────────┘                  └──────┬───────┘
                                     │ SQLAlchemy
                                     ▼
                              ┌──────────────┐
                              │  MySQL 8     │
                              │  (:3306)     │
                              └──────────────┘
```

### Bind Volumes

| Host path | Container path | Purpose |
|-----------|---------------|---------|
| `./mysql/init` | `/docker-entrypoint-initdb.d` | SQL schema run on first start |
| `./data/mysql` | `/var/lib/mysql` | MySQL data persistence |

---

## Quick Start

### Prerequisites

- Docker and Docker Compose

### Setup

1. Clone the repository
2. Copy `.env.example` to `.env` (edit credentials if desired)
3. Start the stack with `docker compose up --build -d`
4. Open `http://localhost` in your browser

### API Documentation

FastAPI auto-generates interactive docs at `http://localhost/api/docs`.

---

## Project Structure

```
dostuff/
├── docker-compose.yml
├── .env.example
├── README.md
├── README_FULL.md
├── mysql/init/
│   └── init.sql            ← Schema initialisation
├── data/mysql/             ← MySQL data (created at runtime, git-ignored)
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── app.py              ← FastAPI application
│   └── tests/
│       └── test_app.py     ← pytest test suite
└── frontend/
    ├── Dockerfile
    ├── .dockerignore
    ├── nginx.conf
    ├── index.html
    ├── css/styles.css
    └── js/app.js
```

---

## Learning Notes

- See `README_FULL.md` for complete command examples.
- MySQL persistence uses a **bind mount** so data survives container restarts.
- The init script in `mysql/init/` runs only when the data directory is empty.
- FastAPI's dependency injection is used to supply a database session per request.
- Tests use an **in-memory SQLite** database — no MySQL required to run the test suite.

---

## License

MIT
