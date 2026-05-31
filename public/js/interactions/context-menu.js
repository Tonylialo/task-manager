import { els } from "../core/dom.js";
import { state, persist } from "../core/state.js";
import { clientToWorld } from "./canvas.js";

let contextMenu = null;

export function bindContextMenus({ openDirectionModal, openTaskModal, renderAll }) {
  document.addEventListener("click", closeContextMenu);

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
        action: () => {
          deleteDirection(direction.id);
          renderAll();
        }
      }
    ]);
  });
}

export function closeContextMenu() {
  if (!contextMenu) return;

  contextMenu.remove();
  contextMenu = null;
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

function deleteDirection(id) {
  state.directions = state.directions.filter(direction => direction.id !== id);
  state.tasks = state.tasks.filter(task => task.directionId !== id);
  persist();
}
