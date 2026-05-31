import { els } from "./core/dom.js";
import { state, persist } from "./core/state.js";

import { renderDirections } from "./render/directions.js";
import { renderTasks, renderNotifications, bindPanelCollapse } from "./render/sidebar.js";
import {
  bindModalEvents,
  setModalRenderCallback,
  openDirectionModal,
  openTaskModal,
  openTaskViewModal,
  closeModal
} from "./render/modals.js";

import { bindCanvas, applyView } from "./interactions/canvas.js";
import { bindKeyboard } from "./interactions/keyboard.js";

let contextMenu = null;

function applyMode() {
  els.workspace.classList.toggle("list-mode", state.viewMode === "list");
  els.viewModeBtn.textContent = "☰";
  els.viewModeBtn.title = state.viewMode === "list" ? "Перейти в поле" : "Перейти в список";
}

function renderAll() {
  applyMode();
  applyView();

  renderDirections({
    onEditDirection: openDirectionModal,
    onChange: renderAll
  });

  renderTasks({
    onOpenTask: openTaskViewModal
  });

  renderNotifications();
  persist();
}

function bindToolbar() {
  els.viewModeBtn.addEventListener("click", () => {
    state.viewMode = state.viewMode === "canvas" ? "list" : "canvas";
    closeContextMenu();
    renderAll();
  });
}

function bindContextMenus() {
  document.addEventListener("click", closeContextMenu);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeContextMenu();
  });

  els.canvas.addEventListener("contextmenu", event => {
    const directionNode = event.target.closest(".direction-node");
    if (directionNode) return;

    event.preventDefault();
    event.stopPropagation();

    if (state.viewMode === "list") return;

    const worldPoint = clientToWorld(event.clientX, event.clientY);

    openContextMenu(event.clientX, event.clientY, [
      {
        label: "Создать направление",
        action: () => openDirectionModal(null, worldPoint)
      }
    ]);
  });

  els.directionsLayer.addEventListener("contextmenu", event => {
    const directionNode = event.target.closest(".direction-node");
    if (!directionNode) return;

    event.preventDefault();
    event.stopPropagation();

    const directionId = directionNode.dataset.id;
    const direction = state.directions.find(item => item.id === directionId);
    if (!direction) return;

    openContextMenu(event.clientX, event.clientY, [
      {
        label: "Создать задачу",
        action: () => openTaskModal(null, direction.id)
      },
      {
        label: "Редактировать",
        action: () => openDirectionModal(direction.id)
      },
      {
        label: "Удалить",
        danger: true,
        action: () => deleteDirection(direction.id)
      }
    ]);
  });
}

function clientToWorld(clientX, clientY) {
  const rect = els.canvas.getBoundingClientRect();

  return {
    x: Math.round((clientX - rect.left - state.view.x) / state.view.scale),
    y: Math.round((clientY - rect.top - state.view.y) / state.view.scale)
  };
}

function openContextMenu(x, y, items) {
  closeContextMenu();

  contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";

  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `context-menu-item ${item.danger ? "danger" : ""}`;
    button.textContent = item.label;

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      closeContextMenu();
      item.action();
    });

    contextMenu.appendChild(button);
  }

  document.body.appendChild(contextMenu);

  const rect = contextMenu.getBoundingClientRect();
  const safeX = Math.min(x, window.innerWidth - rect.width - 12);
  const safeY = Math.min(y, window.innerHeight - rect.height - 12);

  contextMenu.style.left = `${Math.max(12, safeX)}px`;
  contextMenu.style.top = `${Math.max(12, safeY)}px`;
}

function closeContextMenu() {
  if (!contextMenu) return;

  contextMenu.remove();
  contextMenu = null;
}

function deleteDirection(id) {
  state.directions = state.directions.filter(direction => direction.id !== id);
  state.tasks = state.tasks.filter(task => task.directionId !== id);

  persist();
  renderAll();
}

setModalRenderCallback(renderAll);

bindToolbar();
bindPanelCollapse();
bindModalEvents();
bindCanvas();
bindKeyboard({ closeModal });
bindContextMenus();

renderAll();

setInterval(() => {
  renderTasks({
    onOpenTask: openTaskViewModal
  });
}, 60_000);
