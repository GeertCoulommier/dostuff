"""
pytest test suite for DoStuff API.

Uses an in-memory SQLite database so no MySQL instance is required.
The DATABASE_URL environment variable is set before importing the app.
"""

import os

# ------------------------------------------------------------------
# Point the app at an in-memory SQLite DB before importing anything
# ------------------------------------------------------------------
os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import Base, Task, app, get_db

# ------------------------------------------------------------------
# Test database setup
# StaticPool ensures all connections share a single in-memory DB.
# ------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite://"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def reset_db():
    """Create tables before each test and drop them after."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


# ------------------------------------------------------------------
# Health check
# ------------------------------------------------------------------


class TestHealth:
    def test_returns_ok(self, client):
        res = client.get("/api/health")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ok"
        assert "timestamp" in body


# ------------------------------------------------------------------
# GET /api/tasks
# ------------------------------------------------------------------


class TestListTasks:
    def test_empty_list(self, client):
        res = client.get("/api/tasks")
        assert res.status_code == 200
        assert res.json() == []

    def test_returns_created_tasks(self, client):
        client.post("/api/tasks", json={"title": "Task A", "priority": "low"})
        client.post("/api/tasks", json={"title": "Task B", "priority": "high"})
        res = client.get("/api/tasks")
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_filter_by_completed(self, client):
        r1 = client.post("/api/tasks", json={"title": "Done", "priority": "low"})
        task_id = r1.json()["id"]
        client.put(f"/api/tasks/{task_id}", json={"completed": True})
        client.post("/api/tasks", json={"title": "Pending", "priority": "medium"})

        done = client.get("/api/tasks?completed=true").json()
        pending = client.get("/api/tasks?completed=false").json()
        assert len(done) == 1
        assert len(pending) == 1

    def test_filter_by_priority(self, client):
        client.post("/api/tasks", json={"title": "A", "priority": "high"})
        client.post("/api/tasks", json={"title": "B", "priority": "low"})
        res = client.get("/api/tasks?priority=high")
        assert res.status_code == 200
        assert all(t["priority"] == "high" for t in res.json())

    def test_invalid_priority_filter_returns_400(self, client):
        res = client.get("/api/tasks?priority=urgent")
        assert res.status_code == 400


# ------------------------------------------------------------------
# POST /api/tasks
# ------------------------------------------------------------------


class TestCreateTask:
    def test_creates_task_with_defaults(self, client):
        res = client.post("/api/tasks", json={"title": "Buy milk"})
        assert res.status_code == 201
        body = res.json()
        assert body["title"] == "Buy milk"
        assert body["priority"] == "medium"
        assert body["deadline"] is None
        assert body["completed"] is False
        assert "id" in body
        assert "created_at" in body
        assert "updated_at" in body

    def test_creates_task_with_all_fields(self, client):
        res = client.post(
            "/api/tasks",
            json={"title": "Dentist", "priority": "high", "deadline": "2025-06-15"},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["priority"] == "high"
        assert body["deadline"] == "2025-06-15"

    def test_strips_whitespace_from_title(self, client):
        res = client.post("/api/tasks", json={"title": "  Trim me  "})
        assert res.status_code == 201
        assert res.json()["title"] == "Trim me"

    def test_missing_title_returns_422(self, client):
        res = client.post("/api/tasks", json={"priority": "low"})
        assert res.status_code == 422

    def test_empty_title_returns_422(self, client):
        res = client.post("/api/tasks", json={"title": ""})
        assert res.status_code == 422

    def test_invalid_priority_returns_400(self, client):
        res = client.post("/api/tasks", json={"title": "x", "priority": "urgent"})
        assert res.status_code == 400

    def test_invalid_deadline_format_returns_422(self, client):
        res = client.post(
            "/api/tasks", json={"title": "x", "deadline": "not-a-date"}
        )
        assert res.status_code == 422


# ------------------------------------------------------------------
# GET /api/tasks/{id}
# ------------------------------------------------------------------


class TestGetTask:
    def test_returns_existing_task(self, client):
        created = client.post("/api/tasks", json={"title": "Find me"}).json()
        res = client.get(f"/api/tasks/{created['id']}")
        assert res.status_code == 200
        assert res.json()["title"] == "Find me"

    def test_not_found_returns_404(self, client):
        res = client.get("/api/tasks/9999")
        assert res.status_code == 404


# ------------------------------------------------------------------
# PUT /api/tasks/{id}
# ------------------------------------------------------------------


class TestUpdateTask:
    def test_updates_title(self, client):
        created = client.post("/api/tasks", json={"title": "Old"}).json()
        res = client.put(f"/api/tasks/{created['id']}", json={"title": "New"})
        assert res.status_code == 200
        assert res.json()["title"] == "New"

    def test_marks_as_completed(self, client):
        created = client.post("/api/tasks", json={"title": "Do it"}).json()
        res = client.put(f"/api/tasks/{created['id']}", json={"completed": True})
        assert res.status_code == 200
        assert res.json()["completed"] is True

    def test_updates_priority_and_deadline(self, client):
        created = client.post("/api/tasks", json={"title": "x"}).json()
        res = client.put(
            f"/api/tasks/{created['id']}",
            json={"priority": "low", "deadline": "2026-01-01"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["priority"] == "low"
        assert body["deadline"] == "2026-01-01"

    def test_invalid_priority_returns_400(self, client):
        created = client.post("/api/tasks", json={"title": "x"}).json()
        res = client.put(
            f"/api/tasks/{created['id']}", json={"priority": "critical"}
        )
        assert res.status_code == 400

    def test_not_found_returns_404(self, client):
        res = client.put("/api/tasks/9999", json={"title": "ghost"})
        assert res.status_code == 404

    def test_partial_update_preserves_other_fields(self, client):
        created = client.post(
            "/api/tasks",
            json={"title": "Keep", "priority": "high", "deadline": "2025-12-31"},
        ).json()
        client.put(f"/api/tasks/{created['id']}", json={"completed": True})
        res = client.get(f"/api/tasks/{created['id']}")
        body = res.json()
        assert body["priority"] == "high"
        assert body["deadline"] == "2025-12-31"
        assert body["completed"] is True


# ------------------------------------------------------------------
# DELETE /api/tasks/{id}
# ------------------------------------------------------------------


class TestDeleteTask:
    def test_deletes_task(self, client):
        created = client.post("/api/tasks", json={"title": "Bye"}).json()
        res = client.delete(f"/api/tasks/{created['id']}")
        assert res.status_code == 204
        assert client.get(f"/api/tasks/{created['id']}").status_code == 404

    def test_not_found_returns_404(self, client):
        res = client.delete("/api/tasks/9999")
        assert res.status_code == 404

    def test_delete_removes_from_list(self, client):
        created = client.post("/api/tasks", json={"title": "Remove"}).json()
        client.delete(f"/api/tasks/{created['id']}")
        tasks = client.get("/api/tasks").json()
        assert all(t["id"] != created["id"] for t in tasks)
