import { els } from "../core/dom.js";
import { state, persist, getSortedDirections } from "../core/state.js";
import { escapeHtml, timeLeft } from "../core/utils.js";

const EMPTY_TEXTS = new Set([
  "",
  "Task created.",
  "Task created",
  "Задача создана.",
  "Задача создана",
  "Untitled task",
]);

let notificationEventsBound = false;
let panelEventsBound = false;

export function renderTasks({ onOpenTask }) {
  const directions = new Map(
    state.directions.map((direction) => [direction.id, direction]),
  );

  const taskItems = state.tasks
    .map((task) => ({
      type: "task",
      task,
      direction: directions.get(task.directionId),
    }))
    .filter((item) => item.direction);

  const emptyDirectionItems = getSortedDirections()
    .filter((direction) => {
      return (
        direction.showAsTask &&
        !state.tasks.some((task) => task.directionId === direction.id)
      );
    })
    .map((direction) => ({
      type: "empty-direction",
      direction,
    }));

  const items = [...taskItems, ...emptyDirectionItems].sort(sortSidebarItems);

  els.taskList.innerHTML = "";

  for (const item of items) {
    if (item.type === "task") {
      renderTaskCard(item.task, item.direction, onOpenTask);
    }

    if (item.type === "empty-direction") {
      renderEmptyDirectionCard(item.direction);
    }
  }
}

function renderTaskCard(task, direction, onOpenTask) {
  const card = document.createElement("div");
  card.className = "task-card";
  card.dataset.taskId = task.id;
  card.style.setProperty("--task-color", direction.color || "#5f6b55");

  const body = cleanBody(task.goal || task.description || "");

  card.innerHTML = `
    <div class="task-top">
      <div class="task-main">
        <h4 class="task-title">${escapeHtml(task.title)}</h4>
        <div class="task-dir">${escapeHtml(direction.symbol || "◌")} ${escapeHtml(direction.title)}</div>
      </div>
      ${task.deadline ? `<div class="timer">${timeLeft(task.deadline)}</div>` : ""}
    </div>
    ${body ? `<p class="goal">${escapeHtml(body)}</p>` : ""}
  `;

  card.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenTask(task.id);
  });

  els.taskList.appendChild(card);
}

function renderEmptyDirectionCard(direction) {
  const card = document.createElement("div");
  card.className = "task-card empty-direction";
  card.style.setProperty("--task-color", direction.color || "#5f6b55");

  const body = cleanBody(direction.goal || "");

  card.innerHTML = `
    <div class="task-top">
      <div class="task-main">
        <h4 class="task-title">${escapeHtml(direction.title)}</h4>
        <div class="task-dir">${escapeHtml(direction.symbol || "◌")} Direction</div>
      </div>
    </div>
    ${body ? `<p class="goal">${escapeHtml(body)}</p>` : ""}
  `;

  els.taskList.appendChild(card);
}

export function renderNotifications() {
  bindNotificationEventsOnce();

  els.notificationList.innerHTML = "";

  for (const item of state.notifications) {
    const notification = document.createElement("div");
    notification.className = `notification ${item.read ? "read" : ""}`;
    notification.dataset.notificationId = item.id;

    notification.innerHTML = `
      <strong>${escapeHtml(item.title)}</strong>
      ${item.text ? `<span>${escapeHtml(item.text)}</span>` : ""}
    `;

    els.notificationList.appendChild(notification);
  }
}

export function bindPanelCollapse(onChange = null) {
  if (panelEventsBound) return;
  panelEventsBound = true;

  document.querySelectorAll(".panel-head").forEach((head) => {
    const panel = head.closest(".panel");
    if (!panel) return;

    head.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      panel.classList.toggle("collapsed");
      window.dispatchEvent(new CustomEvent("panel-layout-change"));
      onChange?.();
    });
  });
}

function bindNotificationEventsOnce() {
  if (notificationEventsBound) return;
  notificationEventsBound = true;

  els.notificationList.addEventListener("click", (event) => {
    const card = event.target.closest(".notification");
    if (!card) return;

    event.preventDefault();
    event.stopPropagation();

    const id = card.dataset.notificationId;
    const item = state.notifications.find(
      (notification) => notification.id === id,
    );
    if (!item) return;

    item.read = !item.read;
    card.classList.toggle("read", item.read);

    persist();

    const allRead =
      state.notifications.length > 0 &&
      state.notifications.every((notification) => notification.read);

    if (allRead) {
      const panel = document.getElementById("notificationsPanel");

      window.setTimeout(() => {
        panel?.classList.add("collapsed");
        window.dispatchEvent(new CustomEvent("panel-layout-change"));
      }, 260);
    }
  });
}

function sortSidebarItems(a, b) {
  const aDeadline = a.task?.deadline || "";
  const bDeadline = b.task?.deadline || "";

  const aHasDeadline = Boolean(aDeadline);
  const bHasDeadline = Boolean(bDeadline);

  if (aHasDeadline && bHasDeadline) {
    return new Date(aDeadline) - new Date(bDeadline);
  }

  if (aHasDeadline && !bHasDeadline) return -1;
  if (!aHasDeadline && bHasDeadline) return 1;

  const aPriority = Number(a.direction?.priority || 999999);
  const bPriority = Number(b.direction?.priority || 999999);

  return aPriority - bPriority;
}

function cleanBody(value) {
  const text = String(value || "").trim();
  return EMPTY_TEXTS.has(text) ? "" : text;
}
