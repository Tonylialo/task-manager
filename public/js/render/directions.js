import { els } from "../core/dom.js";
import { state, persist, getSortedDirections, reorderDirections } from "../core/state.js";
import { escapeHtml } from "../core/utils.js";

let draggingListDirectionId = null;

export function renderDirections({ onEditDirection, onChange }) {
  els.directionsLayer.innerHTML = "";

  const directions = state.viewMode === "list"
    ? getSortedDirections()
    : state.directions;

  for (const direction of directions) {
    const taskCount = state.tasks.filter(task => task.directionId === direction.id).length;

    const node = document.createElement("div");
    node.className = "direction-node";
    node.dataset.id = direction.id;
    node.style.left = `${direction.x}px`;
    node.style.top = `${direction.y}px`;
    node.style.setProperty("--node-color", direction.color || "#5f6b55");

    if (state.viewMode === "list") {
      node.draggable = true;
      enableListReorder(node, direction, onChange);
    } else {
      enableDirectionDrag(node, direction);
    }

    const goalHtml = direction.goal
      ? `<div class="direction-goal">${escapeHtml(direction.goal)}</div>`
      : "";

    node.innerHTML = `
      <div class="direction-head">
        <div class="direction-symbol">${escapeHtml(direction.symbol || "◌")}</div>

        <div class="direction-title">
          <div class="direction-title-line">
            <strong>${escapeHtml(direction.title)}</strong>
            <span class="direction-priority">${escapeHtml(direction.priority)}</span>
          </div>
        </div>
      </div>

      ${goalHtml}

      <div class="direction-meta">
        <span>${taskCount} задач</span>
      </div>
    `;

    node.addEventListener("dblclick", event => {
      event.stopPropagation();
      onEditDirection(direction.id);
    });

    els.directionsLayer.appendChild(node);
  }
}

function enableDirectionDrag(node, direction) {
  let active = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  node.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;

    active = true;
    startX = event.clientX;
    startY = event.clientY;
    originX = direction.x;
    originY = direction.y;

    node.setPointerCapture(event.pointerId);
    event.stopPropagation();
  });

  node.addEventListener("pointermove", event => {
    if (!active) return;

    const dx = (event.clientX - startX) / state.view.scale;
    const dy = (event.clientY - startY) / state.view.scale;

    direction.x = Math.round(originX + dx);
    direction.y = Math.round(originY + dy);

    node.style.left = `${direction.x}px`;
    node.style.top = `${direction.y}px`;
  });

  node.addEventListener("pointerup", () => {
    if (!active) return;

    active = false;
    persist();
  });
}

function enableListReorder(node, direction, onChange) {
  node.addEventListener("dragstart", event => {
    draggingListDirectionId = direction.id;
    node.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
  });

  node.addEventListener("dragend", () => {
    draggingListDirectionId = null;
    node.classList.remove("dragging");
  });

  node.addEventListener("dragover", event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  node.addEventListener("drop", event => {
    event.preventDefault();

    if (!draggingListDirectionId || draggingListDirectionId === direction.id) return;

    reorderDirections(draggingListDirectionId, direction.id);
    persist();
    onChange();
  });
}
