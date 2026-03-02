/**
 * DoStuff — frontend app
 * Vanilla JS, no framework.
 */

"use strict";

const API = "/api";

// ── State ──────────────────────────────────────────────────────
let tasks          = [];
let filterStatus   = "all";      // "all" | "pending" | "done"
let filterPriority = null;       // null | "low" | "medium" | "high"
let toastTimer     = null;

// ── DOM refs ───────────────────────────────────────────────────
const taskList   = document.getElementById("taskList");
const emptyMsg   = document.getElementById("emptyMsg");
const loadingMsg = document.getElementById("loadingMsg");

const statTotal   = document.getElementById("statTotal");
const statDone    = document.getElementById("statDone");
const statPending = document.getElementById("statPending");

const addForm       = document.getElementById("addForm");
const inputTitle    = document.getElementById("inputTitle");
const inputPriority = document.getElementById("inputPriority");
const inputDeadline = document.getElementById("inputDeadline");
const formError     = document.getElementById("formError");

const editModal    = document.getElementById("editModal");
const editForm     = document.getElementById("editForm");
const editId       = document.getElementById("editId");
const editTitle    = document.getElementById("editTitle");
const editPriority = document.getElementById("editPriority");
const editDeadline = document.getElementById("editDeadline");
const editError    = document.getElementById("editError");
const modalClose   = document.getElementById("modalClose");
const modalCancel  = document.getElementById("modalCancel");

const toast = document.getElementById("toast");

// ── API helpers ────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

// ── Fetch & render ──────────────────────────────────────────────

async function loadTasks() {
  loadingMsg.hidden = false;
  emptyMsg.hidden   = true;
  taskList.innerHTML = "";
  try {
    tasks = await apiFetch("/tasks");
    renderTasks();
  } catch (err) {
    showToast("Failed to load tasks: " + err.message, "error");
  } finally {
    loadingMsg.hidden = true;
  }
}

function renderTasks() {
  // Apply filters
  let visible = tasks.slice();

  if (filterStatus === "done")    visible = visible.filter(t => t.completed);
  if (filterStatus === "pending") visible = visible.filter(t => !t.completed);
  if (filterPriority)             visible = visible.filter(t => t.priority === filterPriority);

  // Stats
  statTotal.textContent   = tasks.length;
  statDone.textContent    = tasks.filter(t => t.completed).length;
  statPending.textContent = tasks.filter(t => !t.completed).length;

  taskList.innerHTML = "";

  if (visible.length === 0) {
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  visible.forEach(task => taskList.appendChild(buildCard(task)));
}

function buildCard(task) {
  const card = document.createElement("div");
  card.className = `task-card priority-${task.priority}${task.completed ? " completed" : ""}`;
  card.dataset.id = task.id;

  // Deadline formatting
  let deadlineMeta = "";
  if (task.deadline) {
    const dl = new Date(task.deadline + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = !task.completed && dl < today;
    const label = dl.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    deadlineMeta = `<span class="meta-deadline${overdue ? " overdue" : ""}">
      ${overdue ? "⚠ " : "📅 "}${label}
    </span>`;
  }

  card.innerHTML = `
    <button class="task-check${task.completed ? " checked" : ""}" title="Toggle complete"
            aria-label="${task.completed ? "Mark incomplete" : "Mark complete"}">
      ${task.completed ? "✓" : ""}
    </button>
    <div class="task-body">
      <p class="task-title">${escHtml(task.title)}</p>
      <div class="task-meta">
        <span class="badge badge-${task.priority}">${task.priority}</span>
        ${deadlineMeta}
      </div>
    </div>
    <div class="task-actions">
      <button class="btn-icon edit-btn" title="Edit" aria-label="Edit task">✏️</button>
      <button class="btn-icon delete-btn btn-danger" title="Delete" aria-label="Delete task">🗑</button>
    </div>
  `;

  card.querySelector(".task-check").addEventListener("click", () => toggleComplete(task));
  card.querySelector(".edit-btn").addEventListener("click", () => openEditModal(task));
  card.querySelector(".delete-btn").addEventListener("click", () => deleteTask(task.id));

  return card;
}

// ── Add task ───────────────────────────────────────────────────

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setFormError(formError, "");

  const title = inputTitle.value.trim();
  if (!title) { setFormError(formError, "Title is required."); return; }

  const body = {
    title,
    priority: inputPriority.value,
    deadline: inputDeadline.value || null,
  };

  try {
    const created = await apiFetch("/tasks", { method: "POST", body: JSON.stringify(body) });
    tasks.unshift(created);
    renderTasks();
    addForm.reset();
    showToast("Task added!", "success");
  } catch (err) {
    setFormError(formError, err.message);
  }
});

// ── Toggle complete ────────────────────────────────────────────

async function toggleComplete(task) {
  try {
    const updated = await apiFetch(`/tasks/${task.id}`, {
      method: "PUT",
      body: JSON.stringify({ completed: !task.completed }),
    });
    updateTaskInState(updated);
    renderTasks();
  } catch (err) {
    showToast("Could not update task: " + err.message, "error");
  }
}

// ── Delete ────────────────────────────────────────────────────

async function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  try {
    await apiFetch(`/tasks/${id}`, { method: "DELETE" });
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
    showToast("Task deleted.", "success");
  } catch (err) {
    showToast("Could not delete task: " + err.message, "error");
  }
}

// ── Edit modal ────────────────────────────────────────────────

function openEditModal(task) {
  editId.value             = task.id;
  editTitle.value          = task.title;
  editPriority.value       = task.priority;
  editDeadline.value       = task.deadline || "";
  setFormError(editError, "");
  editModal.hidden = false;
  editTitle.focus();
}

function closeEditModal() {
  editModal.hidden = true;
}

modalClose.addEventListener("click", closeEditModal);
modalCancel.addEventListener("click", closeEditModal);
editModal.addEventListener("click", (e) => { if (e.target === editModal) closeEditModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeEditModal(); });

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setFormError(editError, "");

  const title = editTitle.value.trim();
  if (!title) { setFormError(editError, "Title is required."); return; }

  const id = parseInt(editId.value, 10);
  const body = {
    title,
    priority: editPriority.value,
    deadline: editDeadline.value || null,
  };

  try {
    const updated = await apiFetch(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    updateTaskInState(updated);
    renderTasks();
    closeEditModal();
    showToast("Task updated!", "success");
  } catch (err) {
    setFormError(editError, err.message);
  }
});

// ── Filter bar ────────────────────────────────────────────────

document.querySelectorAll(".filter-btn[data-filter]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn[data-filter]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filterStatus = btn.dataset.filter;
    renderTasks();
  });
});

document.querySelectorAll(".filter-btn[data-priority]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (filterPriority === btn.dataset.priority) {
      filterPriority = null;
      btn.classList.remove("active");
      document.getElementById("clearPriority").hidden = true;
    } else {
      document.querySelectorAll(".filter-btn[data-priority]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterPriority = btn.dataset.priority;
      document.getElementById("clearPriority").hidden = false;
    }
    renderTasks();
  });
});

document.getElementById("clearPriority").addEventListener("click", () => {
  filterPriority = null;
  document.querySelectorAll(".filter-btn[data-priority]").forEach(b => b.classList.remove("active"));
  document.getElementById("clearPriority").hidden = true;
  renderTasks();
});

// ── Helpers ───────────────────────────────────────────────────

function updateTaskInState(updated) {
  const idx = tasks.findIndex(t => t.id === updated.id);
  if (idx !== -1) tasks[idx] = updated;
}

function setFormError(el, msg) {
  el.textContent = msg;
  el.hidden = !msg;
}

function showToast(msg, type = "") {
  toast.textContent = msg;
  toast.className = "toast" + (type ? " " + type : "");
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Bootstrap ─────────────────────────────────────────────────
loadTasks();
