import { els } from "../core/dom.js";
import {
  state,
  persist,
  getSortedDirections,
  reorderDirections,
} from "../core/state.js";
import { escapeHtml } from "../core/utils.js";
import { drawLinesAndShip } from "../layout.js";

let draggingListDirectionId = null;

const CARD_HEIGHT = 108;
const TASK_ROW_HEIGHT = 46;

export function renderDirections({
  onEditDirection,
  onSelectDirection,
  selectedId,
  selectedTaskId,
  onChange,
  mode = "idle",
  focusedDirectionId = null,
  onEnterFocus,
  onExitFocus,
  onSelectTask,
  onOpenTask,
}) {
  const container = els.directionsLayer;
  container.innerHTML = "";

  document.querySelector(".direction-focus-overlay")?.remove();
  els.world.querySelector(".field-geometry")?.remove();

  els.workspace.classList.toggle("direction-focus-mode", mode === "focus");

  const directions = getSortedDirections();
  if (!directions.length) {
    resetWorldSize();
    setToolbarNearShip(null);
    return;
  }

  const geometry = state.viewMode === "list"
    ? computeListGeometry(directions.length)
    : computeCanvasGeometry(directions.length);

  els.world.style.height = `${geometry.worldHeight}px`;
  els.world.style.minHeight = `${geometry.worldHeight}px`;
  els.canvas.style.height = `${geometry.worldHeight}px`;
  els.canvas.style.minHeight = `${geometry.worldHeight}px`;
  els.world.dataset.shipY = String(Math.round(geometry.shipY));
  setToolbarNearShip(geometry.shipY);

  const layout = directions.map((dir, idx) => {
    const side = geometry.isList || geometry.isNarrow ? 0 : idx % 2 === 0 ? 1 : -1;
    const cardCenterX = geometry.centerX + side * geometry.offsetX;
    const cardY = geometry.shipY - geometry.shipGap - idx * geometry.stepY;
    const tasksY = cardY - TASK_ROW_HEIGHT - 14;

    return {
      id: dir.id,
      cardX: cardCenterX,
      cardY,
      tasksY,
      side,
    };
  });

  for (const dir of directions) {
    const pos = layout.find((item) => item.id === dir.id);
    if (!pos) continue;

    const left = getSafeLeft(pos, geometry);
    const right = left + geometry.cardWidth;
    const tasksOfDir = getSortedTasksForDirection(dir.id);

    if (state.viewMode !== "list") {
      renderTaskChips(container, {
        tasks: tasksOfDir,
        direction: dir,
        cardLeft: left,
        cardRight: right,
        centerX: pos.cardX,
        lineX: geometry.centerX,
        top: pos.tasksY,
        onOpenTask,
      });
    }

    const node = createDirectionCard({
      direction: dir,
      selected: selectedId === dir.id,
      left,
      top: pos.cardY,
      width: geometry.cardWidth,
    });

    node.draggable = state.viewMode === "list";
    if (state.viewMode === "list") {
      enableListReorder(node, dir, onChange);
    }

    node.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      onEditDirection(dir.id);
    });

    node.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectDirection?.(dir.id);
      onEnterFocus?.(dir.id);
    });

    container.appendChild(node);
  }

  drawLinesAndShip(
    layout.map((pos) => ({
      id: pos.id,
      x: pos.cardX,
      y: pos.cardY,
      cardWidth: geometry.cardWidth,
      cardHeight: CARD_HEIGHT,
    })),
    geometry.workspaceRect,
    geometry.shipY,
  );

  if (mode === "focus" && focusedDirectionId) {
    const direction = directions.find((item) => item.id === focusedDirectionId);
    if (direction) {
      renderFocusOverlay({
        direction,
        tasks: getSortedTasksForDirection(direction.id),
        selectedTaskId,
        onExitFocus,
        onSelectTask,
        onOpenTask,
      });
    }
  }
}

function createDirectionCard({ direction, selected = false, left, top, width }) {
  const node = document.createElement("div");
  node.className = `direction-node ${selected ? "selected" : ""}`;
  node.dataset.id = direction.id;
  node.style.setProperty("--node-color", direction.color || "#5f6b55");
  node.style.position = "absolute";
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
  node.style.width = `${width}px`;
  node.style.zIndex = "30";

  node.innerHTML = `
    <div class="direction-content">
      <div class="direction-symbol">${escapeHtml(direction.symbol || "◌")}</div>
      <strong class="direction-name">${escapeHtml(direction.title || "Untitled direction")}</strong>
    </div>
  `;

  return node;
}

function renderTaskChips(container, {
  tasks,
  direction,
  cardLeft,
  cardRight,
  centerX,
  lineX,
  top,
  onOpenTask,
}) {
  if (!tasks.length) return;

  const row = document.createElement("div");
  row.className = "direction-tasks-row";
  row.style.top = `${top}px`;
  row.style.setProperty("--task-color", direction.color || "#5f6b55");

  if (Math.abs(centerX - lineX) < 24) {
    row.classList.add("center-side");
    row.style.left = `${centerX}px`;
  } else if (centerX > lineX) {
    row.classList.add("right-side");
    row.style.left = `${cardLeft}px`;
  } else {
    row.classList.add("left-side");
    row.style.left = `${cardRight}px`;
  }

  for (const task of tasks) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "direction-task-chip";
    chip.dataset.taskId = task.id;
    chip.innerHTML = `<strong>${escapeHtml(task.title)}</strong>`;

    if (task.deadline) {
      chip.innerHTML += `<span>⏱ ${escapeHtml(formatDeadline(task.deadline))}</span>`;
    }

    chip.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onOpenTask?.(task.id);
    });

    chip.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    row.appendChild(chip);
  }

  container.appendChild(row);
}

function renderFocusOverlay({
  direction,
  tasks,
  selectedTaskId,
  onExitFocus,
  onSelectTask,
  onOpenTask,
}) {
  const workspaceRect = els.workspace.getBoundingClientRect();
  const overlay = document.createElement("div");
  overlay.className = "direction-focus-overlay";
  overlay.style.left = `${workspaceRect.left}px`;
  overlay.style.top = `${workspaceRect.top}px`;
  overlay.style.width = `${workspaceRect.width}px`;
  overlay.style.height = `${workspaceRect.height}px`;
  overlay.style.setProperty("--node-color", direction.color || "#5f6b55");

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      event.preventDefault();
      event.stopPropagation();
      onExitFocus?.();
    }
  });

  const stage = document.createElement("div");
  stage.className = "direction-focus-stage";

  const left = document.createElement("div");
  left.className = "direction-focus-tasks";

  if (tasks.length) {
    for (const task of tasks) {
      const taskCard = document.createElement("button");
      taskCard.type = "button";
      taskCard.className = `focus-task-card ${selectedTaskId === task.id ? "selected" : ""}`;
      taskCard.dataset.taskId = task.id;
      taskCard.style.setProperty("--task-color", direction.color || "#5f6b55");
      taskCard.innerHTML = `
        <strong>${escapeHtml(task.title)}</strong>
        ${task.goal ? `<span>${escapeHtml(task.goal)}</span>` : ""}
        ${task.deadline ? `<small>⏱ ${escapeHtml(formatDeadline(task.deadline))}</small>` : ""}
      `;

      taskCard.addEventListener("mouseenter", () => {
        onSelectTask?.(task.id);
        taskCard.focus({ preventScroll: true });
      });

      taskCard.addEventListener("focus", () => {
        onSelectTask?.(task.id);
      });

      taskCard.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectTask?.(task.id);
        onOpenTask?.(task.id);
      });

      taskCard.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      left.appendChild(taskCard);
    }
  } else {
    const empty = document.createElement("div");
    empty.className = "focus-task-empty";
    empty.textContent = "This direction has no tasks yet";
    left.appendChild(empty);
  }

  const right = document.createElement("button");
  right.type = "button";
  right.className = "direction-focus-card";
  right.innerHTML = `
    <span class="focus-card-symbol">${escapeHtml(direction.symbol || "◌")}</span>
    <strong>${escapeHtml(direction.title || "Untitled direction")}</strong>
    ${direction.goal ? `<em>${escapeHtml(direction.goal)}</em>` : ""}
  `;

  right.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onExitFocus?.();
  });

  stage.appendChild(left);
  stage.appendChild(right);
  overlay.appendChild(stage);
  document.body.appendChild(overlay);
}

function computeCanvasGeometry(directionCount) {
  const workspaceRect = els.workspace.getBoundingClientRect();
  const workspaceWidth = els.workspace.clientWidth || workspaceRect.width;
  const workspaceHeight = els.workspace.clientHeight || workspaceRect.height;
  const isNarrow = workspaceWidth < 720;
  const cardWidth = Math.min(280, Math.max(220, workspaceWidth - 32));
  const centerX = workspaceWidth / 2;
  const offsetX = isNarrow
    ? 0
    : Math.max(100, Math.min(300, (workspaceWidth - cardWidth) / 2 - 24));
  const stepY = isNarrow ? 158 : 170;
  const shipGap = isNarrow ? 182 : 212;
  const topPadding = 110 + TASK_ROW_HEIGHT;
  const shipBottomPadding = 108;
  const routeHeight =
    topPadding + (directionCount - 1) * stepY + shipGap + shipBottomPadding;
  const worldHeight = Math.max(workspaceHeight, routeHeight);
  const shipY = worldHeight - shipBottomPadding;

  return {
    workspaceRect,
    workspaceWidth,
    workspaceHeight,
    isNarrow,
    isList: false,
    cardWidth,
    halfCardWidth: cardWidth / 2,
    centerX,
    offsetX,
    stepY,
    shipGap,
    worldHeight,
    shipY,
  };
}

function computeListGeometry(directionCount) {
  const workspaceRect = els.workspace.getBoundingClientRect();
  const workspaceWidth = els.workspace.clientWidth || workspaceRect.width;
  const workspaceHeight = els.workspace.clientHeight || workspaceRect.height;
  const cardWidth = Math.min(420, Math.max(230, workspaceWidth - 42));
  const centerX = workspaceWidth / 2;
  const stepY = 132;
  const shipGap = 164;
  const topPadding = 92;
  const shipBottomPadding = 108;
  const routeHeight = topPadding + (directionCount - 1) * stepY + shipGap + shipBottomPadding;
  const worldHeight = Math.max(workspaceHeight, routeHeight);
  const shipY = worldHeight - shipBottomPadding;

  return {
    workspaceRect,
    workspaceWidth,
    workspaceHeight,
    isNarrow: true,
    isList: true,
    cardWidth,
    halfCardWidth: cardWidth / 2,
    centerX,
    offsetX: 0,
    stepY,
    shipGap,
    worldHeight,
    shipY,
  };
}

function getSafeLeft(pos, geometry) {
  return Math.max(
    16,
    Math.min(
      pos.cardX - geometry.halfCardWidth,
      geometry.workspaceWidth - geometry.cardWidth - 16,
    ),
  );
}

function resetWorldSize() {
  els.world.style.height = "";
  els.world.style.minHeight = "";
  els.canvas.style.height = "";
  els.canvas.style.minHeight = "";
  delete els.world.dataset.shipY;
}

function setToolbarNearShip(shipY) {
  const toolbar = document.querySelector(".toolbar");
  if (!toolbar) return;

  if (!shipY) {
    toolbar.style.top = "";
    toolbar.style.left = "";
    return;
  }

  toolbar.style.top = `${Math.round(shipY + 38)}px`;
  toolbar.style.left = "50%";
}

function enableListReorder(node, direction, onChange) {
  node.addEventListener("dragstart", (event) => {
    draggingListDirectionId = direction.id;
    node.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", direction.id);
  });

  node.addEventListener("dragend", () => {
    draggingListDirectionId = null;
    clearDragClasses();
  });

  node.addEventListener("dragenter", (event) => {
    event.preventDefault();
    if (draggingListDirectionId && draggingListDirectionId !== direction.id) {
      node.classList.add("drag-over");
    }
  });

  node.addEventListener("dragleave", () => {
    node.classList.remove("drag-over", "drag-over-before", "drag-over-after");
  });

  node.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!draggingListDirectionId || draggingListDirectionId === direction.id) return;

    const rect = node.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    node.classList.toggle("drag-over-before", before);
    node.classList.toggle("drag-over-after", !before);
    event.dataTransfer.dropEffect = "move";
  });

  node.addEventListener("drop", (event) => {
    event.preventDefault();

    if (!draggingListDirectionId || draggingListDirectionId === direction.id) {
      clearDragClasses();
      return;
    }

    reorderDirections(draggingListDirectionId, direction.id);
    persist();
    clearDragClasses();
    onChange?.();
  });
}

function clearDragClasses() {
  document.querySelectorAll(".direction-node").forEach((node) => {
    node.classList.remove("dragging", "drag-over", "drag-over-before", "drag-over-after");
  });
}

function getSortedTasksForDirection(directionId) {
  return state.tasks
    .filter((task) => task.directionId === directionId)
    .sort((a, b) => {
      const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;

      if (aDeadline !== bDeadline) return aDeadline - bDeadline;

      const aCreated = new Date(a.createdAt || 0).getTime();
      const bCreated = new Date(b.createdAt || 0).getTime();

      return aCreated - bCreated;
    });
}

function formatDeadline(value) {
  if (!value) return "";
  const [datePart, timePart = ""] = String(value).split("T");
  const time = timePart.slice(0, 5);
  return time ? `${datePart} ${time}` : datePart;
}
