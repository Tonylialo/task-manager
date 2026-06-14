import { els } from "./core/dom.js";
import { state, persist } from "./core/state.js";
import {
  bindKeyboardNavigation,
  syncSelectionFromOutside,
} from "./interactions/keyboardNav.js";

import { renderDirections } from "./render/directions.js";
import {
  renderTasks,
  renderNotifications,
  bindPanelCollapse,
} from "./render/sidebar.js";
import {
  bindModalEvents,
  setModalRenderCallback,
  openDirectionModal,
  openTaskModal,
  closeModal,
} from "./render/modals.js";

import { bindCanvas, applyView } from "./interactions/canvas.js";
import { bindKeyboard } from "./interactions/keyboard.js";

let contextMenu = null;
let selectedDirectionId = null;
let focusedDirectionId = null;
let selectedTaskId = null;
let navigationMode = "idle"; // idle | focus
let createDirectionBtn = null;
let didInitialScrollToShip = false;
let panelRenderTimer = null;
let panelLayoutFrame = null;

function applyMode() {
  els.workspace.classList.toggle("list-mode", state.viewMode === "list");
  els.workspace.classList.toggle("direction-focus-mode", navigationMode === "focus");

  els.viewModeBtn.textContent = "☰";
  els.viewModeBtn.title =
    state.viewMode === "list" ? "Switch to field · F / O" : "Switch to list · F / O";
}

function renderAll(options = {}) {
  const {
    scrollToBottom = false,
    preserveScroll = false,
    fieldOnly = false,
  } = options;
  const previousScrollTop = els.workspace.scrollTop;

  applyMode();
  applyView();

  renderDirections({
    onEditDirection: openDirectionModal,
    onChange: () => renderAll(),
    onSelectDirection: (id) => {
      selectedDirectionId = id;
      syncSelectionFromOutside(selectedDirectionId);
    },
    selectedId: selectedDirectionId,
    selectedTaskId,
    onCenterDirection: centerOnDirection,
    mode: navigationMode,
    focusedDirectionId,
    onEnterFocus: enterFocusMode,
    onExitFocus: exitFocusMode,
    onSelectTask: setSelectedTaskId,
    onOpenTask: openTaskModal,
  });

  if (!fieldOnly) {
    renderTasks({ onOpenTask: openTaskModal });
    renderNotifications();
    persist();
  }

  syncSelectionFromOutside(selectedDirectionId);

  requestAnimationFrame(() => {
    if (preserveScroll) {
      els.workspace.scrollTop = clampScrollValue(previousScrollTop);
    }

    clampWorkspaceScroll();

    if ((!didInitialScrollToShip || scrollToBottom) && state.viewMode === "canvas") {
      didInitialScrollToShip = true;
      scrollToShip("auto");
    }
  });
}

function bindToolbar() {
  els.viewModeBtn.addEventListener("click", toggleViewMode);
  initCreateDirectionButton();
  hideLegacyExitButton();

  document.addEventListener("keydown", (event) => {
    if (els.modalBackdrop.classList.contains("open")) return;
    if (isTyping(event.target)) return;

    if (isToggleViewKey(event)) {
      event.preventDefault();
      toggleViewMode();
    }
  });
}

function isToggleViewKey(event) {
  const key = String(event.key || "").toLowerCase();
  return (
    event.code === "KeyF" ||
    event.code === "KeyO" ||
    key === "f" ||
    key === "а" ||
    key === "o" ||
    key === "о"
  );
}

function isTyping(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}

function toggleViewMode() {
  state.viewMode = state.viewMode === "canvas" ? "list" : "canvas";
  closeContextMenu();
  exitFocusMode({ render: false, keepSelection: false });
  selectedDirectionId = null;
  selectedTaskId = null;
  renderAll({ scrollToBottom: false });
}

function initCreateDirectionButton() {
  document.getElementById("toolbarMenuBtn")?.remove();
  const toolbar = document.querySelector(".toolbar");
  if (!toolbar || document.getElementById("toolbarCreateDirectionBtn")) return;

  createDirectionBtn = document.createElement("button");
  createDirectionBtn.id = "toolbarCreateDirectionBtn";
  createDirectionBtn.className = "btn create-direction-btn";
  createDirectionBtn.textContent = "Create direction";
  createDirectionBtn.title = "Create a new direction";
  toolbar.insertBefore(createDirectionBtn, els.viewModeBtn);

  createDirectionBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const workspaceRect = els.workspace.getBoundingClientRect();
    const x = workspaceRect.left + workspaceRect.width / 2;
    const y = workspaceRect.top + workspaceRect.height / 2;
    openDirectionModal(null, clientToWorld(x, y));
  });
}

function hideLegacyExitButton() {
  const exitButton = document.getElementById("exitCenterBtn");
  if (exitButton) exitButton.remove();
}

function bindContextMenus() {
  document.addEventListener("click", () => closeContextMenu());

  document.addEventListener("contextmenu", (event) => {
    const taskNode = event.target.closest("[data-task-id]");
    if (!taskNode) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openTaskContextMenu(taskNode.dataset.taskId, event.clientX, event.clientY);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeContextMenu();
      return;
    }

    if (isContextMenuKey(event)) {
      if (els.modalBackdrop.classList.contains("open")) return;
      if (isTyping(event.target)) return;

      event.preventDefault();
      event.stopPropagation();
      openKeyboardContextMenu(event.target);
    }
  });

  els.canvas.addEventListener("contextmenu", (event) => {
    const taskNode = event.target.closest("[data-task-id]");
    if (taskNode) return;

    const directionNode = event.target.closest(".direction-node");
    if (directionNode) return;

    event.preventDefault();
    event.stopPropagation();

    const worldPoint = clientToWorld(event.clientX, event.clientY);
    openWorkspaceMenu(event.clientX, event.clientY, worldPoint);
  });

  els.directionsLayer.addEventListener("contextmenu", (event) => {
    const taskNode = event.target.closest("[data-task-id]");
    if (taskNode) {
      event.preventDefault();
      event.stopPropagation();
      openTaskContextMenu(taskNode.dataset.taskId, event.clientX, event.clientY);
      return;
    }

    const directionNode = event.target.closest(".direction-node");
    if (!directionNode) return;

    event.preventDefault();
    event.stopPropagation();

    openDirectionContextMenu(directionNode.dataset.id, event.clientX, event.clientY);
  });

  els.taskList.addEventListener("contextmenu", (event) => {
    const taskNode = event.target.closest("[data-task-id]");
    if (!taskNode) return;

    event.preventDefault();
    event.stopPropagation();
    openTaskContextMenu(taskNode.dataset.taskId, event.clientX, event.clientY);
  });

  document.addEventListener("contextmenu", (event) => {
    const taskNode = event.target.closest(".focus-task-card[data-task-id]");
    if (!taskNode) return;

    event.preventDefault();
    event.stopPropagation();
    openTaskContextMenu(taskNode.dataset.taskId, event.clientX, event.clientY);
  });
}

function openToolbarMenu() {
  const workspaceRect = els.workspace.getBoundingClientRect();
  const x = workspaceRect.left + workspaceRect.width / 2;
  const y = workspaceRect.top + workspaceRect.height / 2;
  openDirectionModal(null, clientToWorld(x, y));
}

function isContextMenuKey(event) {
  return (
    event.key === "ContextMenu" ||
    event.key === "Apps" ||
    event.code === "ContextMenu" ||
    event.code === "Apps" ||
    (event.shiftKey && event.key === "F10")
  );
}

function openKeyboardContextMenu(target) {
  const active = target?.closest ? target : document.activeElement;
  const selectedTaskNode = selectedTaskId
    ? document.querySelector(`[data-task-id="${CSS.escape(selectedTaskId)}"]`)
    : null;
  const taskNode =
    active?.closest?.("[data-task-id]") ||
    selectedTaskNode ||
    document.querySelector(".focus-task-card.selected[data-task-id]");

  if (taskNode?.dataset?.taskId) {
    const rect = taskNode.getBoundingClientRect();
    openTaskContextMenu(
      taskNode.dataset.taskId,
      Math.round(rect.left + Math.min(32, rect.width / 2)),
      Math.round(rect.top + rect.height / 2),
    );
    return;
  }

  const selectedDirectionNode = selectedDirectionId
    ? document.querySelector(`.direction-node[data-id="${CSS.escape(selectedDirectionId)}"]`)
    : null;
  const directionNode = active?.closest?.(".direction-node") || selectedDirectionNode;

  if (directionNode?.dataset?.id) {
    const rect = directionNode.getBoundingClientRect();
    openDirectionContextMenu(
      directionNode.dataset.id,
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    );
    return;
  }

  const workspaceRect = els.workspace.getBoundingClientRect();
  const x = Math.round(workspaceRect.left + workspaceRect.width / 2);
  const y = Math.round(workspaceRect.top + workspaceRect.height / 2);
  openWorkspaceMenu(x, y, clientToWorld(x, y));
}

function openWorkspaceMenu(x, y, worldPoint) {
  openContextMenu(x, y, [
    {
      label: "Create direction",
      action: () => openDirectionModal(null, worldPoint),
    },
  ]);
}

function openDirectionContextMenu(directionId, x, y) {
  const direction = state.directions.find((item) => item.id === directionId);
  if (!direction) return;

  selectedDirectionId = direction.id;
  syncSelectionFromOutside(selectedDirectionId);
  updateDirectionSelectionClass();

  openContextMenu(x, y, [
    {
      label: "Create task",
      action: () => openTaskModal(null, direction.id),
    },
    {
      label: "Edit",
      action: () => openDirectionModal(direction.id),
    },
    {
      label: "Delete",
      danger: true,
      action: () => deleteDirection(direction.id),
    },
  ]);
}

function openTaskContextMenu(taskId, x, y) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;

  openContextMenu(x, y, [
    {
      label: "Edit",
      action: () => openTaskModal(task.id),
    },
    {
      label: "Task completed",
      action: () => completeTask(task.id),
    },
    {
      label: "Delete",
      danger: true,
      action: () => deleteTask(task.id),
    },
  ]);
}

function clientToWorld(clientX, clientY) {
  const rect = els.canvas.getBoundingClientRect();

  return {
    x: Math.round(clientX - rect.left),
    y: Math.round(clientY - rect.top + els.workspace.scrollTop),
  };
}

function openContextMenu(x, y, items) {
  closeContextMenu(true);

  contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";

  for (const item of items) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `context-menu-item ${item.danger ? "danger" : ""}`;
    button.textContent = item.label;

    button.addEventListener("click", (event) => {
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

  requestAnimationFrame(() => {
    contextMenu?.classList.add("open");
  });
}

function closeContextMenu(immediate = false) {
  if (!contextMenu) return;

  const menu = contextMenu;
  contextMenu = null;

  if (immediate) {
    menu.remove();
    return;
  }

  menu.classList.add("closing");
  window.setTimeout(() => menu.remove(), 150);
}

function deleteDirection(id) {
  state.directions = state.directions.filter(
    (direction) => direction.id !== id,
  );

  state.tasks = state.tasks.filter((task) => task.directionId !== id);

  if (selectedDirectionId === id) {
    selectedDirectionId = null;
    focusedDirectionId = null;
    selectedTaskId = null;
    navigationMode = "idle";
  }

  persist();
  renderAll();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);

  if (selectedTaskId === id) selectedTaskId = null;

  persist();
  renderAll();
}

function completeTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  const direction = state.directions.find((item) => item.id === task.directionId);
  const completedAt = new Date().toISOString();

  if (!Array.isArray(state.completedTasks)) {
    state.completedTasks = [];
  }

  state.completedTasks.push({
    ...JSON.parse(JSON.stringify(task)),
    completedAt,
    completedDate: completedAt.slice(0, 10),
    completionSource: "manual-context-menu",
    directionSnapshot: direction
      ? {
          id: direction.id,
          title: direction.title,
          symbol: direction.symbol,
          color: direction.color,
          priority: direction.priority,
        }
      : null,
  });

  state.tasks = state.tasks.filter((item) => item.id !== id);
  if (selectedTaskId === id) selectedTaskId = null;

  persist();
  renderAll();
}

function enterFocusMode(id = selectedDirectionId) {
  if (!id) return;

  const direction = state.directions.find((item) => item.id === id);
  if (!direction) return;

  const tasks = state.tasks.filter((task) => task.directionId === direction.id);

  navigationMode = "focus";
  selectedDirectionId = direction.id;
  focusedDirectionId = direction.id;
  selectedTaskId = tasks[0]?.id || null;

  renderAll();
}

function exitFocusMode(options = {}) {
  const { render = true, keepSelection = true } = options;

  if (navigationMode !== "focus" && !focusedDirectionId) return;

  navigationMode = "idle";
  focusedDirectionId = null;
  selectedTaskId = null;
  document.querySelector(".direction-focus-overlay")?.remove();

  if (!keepSelection) {
    selectedDirectionId = null;
    syncSelectionFromOutside(null);
  }

  applyMode();

  if (render) {
    renderAll();
  }

  if (keepSelection && selectedDirectionId) {
    requestAnimationFrame(() => centerOnDirection(selectedDirectionId));
  }
}

function getFocusedTasks() {
  if (!focusedDirectionId) return [];
  return state.tasks.filter((task) => task.directionId === focusedDirectionId);
}

function setSelectedTaskId(id) {
  selectedTaskId = id;

  document.querySelectorAll(".focus-task-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.taskId === id);
  });

  if (!id) return;

  requestAnimationFrame(() => {
    document
      .querySelector(`.focus-task-card[data-task-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function setSelectedDirectionId(id, options = {}) {
  selectedDirectionId = id;
  syncSelectionFromOutside(id);
  updateDirectionSelectionClass();

  if (id && options.center !== false) {
    centerOnDirection(id);
  }
}

function updateDirectionSelectionClass() {
  document.querySelectorAll(".direction-node").forEach((card) => {
    card.classList.toggle("selected", card.dataset.id === selectedDirectionId);
  });
}

function centerOnDirection(directionId) {
  const card = document.querySelector(
    `.direction-node[data-id="${CSS.escape(directionId)}"]`,
  );

  if (!card) return;

  const workspaceRect = els.workspace.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();

  const delta =
    cardRect.top -
    workspaceRect.top -
    workspaceRect.height / 2 +
    cardRect.height / 2;

  const target = clampScrollValue(els.workspace.scrollTop + delta);

  els.workspace.scrollTo({
    top: target,
    behavior: "smooth",
  });
}

function scrollToShip(behavior = "smooth") {
  const shipY = Number(els.world.dataset.shipY || 0);
  const rawTarget = shipY
    ? shipY - els.workspace.clientHeight + 152
    : getMaxWorkspaceScroll();

  els.workspace.scrollTo({
    top: clampScrollValue(rawTarget),
    behavior,
  });
}

function followPanelLayoutTransition(duration = 380) {
  if (panelLayoutFrame) {
    cancelAnimationFrame(panelLayoutFrame);
    panelLayoutFrame = null;
  }

  const startedAt = performance.now();
  const previousScrollTop = els.workspace.scrollTop;

  function tick(now) {
    renderAll({ preserveScroll: true, fieldOnly: true });
    els.workspace.scrollTop = clampScrollValue(previousScrollTop);

    if (now - startedAt < duration) {
      panelLayoutFrame = requestAnimationFrame(tick);
      return;
    }

    panelLayoutFrame = null;
    renderAll({ preserveScroll: true });
  }

  panelLayoutFrame = requestAnimationFrame(tick);
}

function getMaxWorkspaceScroll() {
  return Math.max(0, els.workspace.scrollHeight - els.workspace.clientHeight);
}

function clampScrollValue(value) {
  return Math.max(0, Math.min(value, getMaxWorkspaceScroll()));
}

function clampWorkspaceScroll() {
  const maxScroll = getMaxWorkspaceScroll();

  if (els.workspace.scrollTop > maxScroll) {
    els.workspace.scrollTop = maxScroll;
  }
}

document.addEventListener("keydown", (event) => {
  if (els.modalBackdrop.classList.contains("open")) return;

  if (event.key === "Escape") {
    if (navigationMode === "focus") {
      event.preventDefault();
      exitFocusMode({ keepSelection: true });
      return;
    }

    if (selectedDirectionId) {
      event.preventDefault();
      selectedDirectionId = null;
      syncSelectionFromOutside(null);
      updateDirectionSelectionClass();
    }
  }
});

setModalRenderCallback(renderAll);
bindToolbar();
bindPanelCollapse();
bindModalEvents();
bindCanvas();
bindKeyboard({ closeModal });
bindContextMenus();

bindKeyboardNavigation({
  getMode: () => navigationMode,
  getSelectedDirectionId: () => selectedDirectionId,
  setSelectedDirectionId,
  enterFocusMode,
  exitFocusMode,
  centerOnDirection,
  getFocusedTasks,
  getSelectedTaskId: () => selectedTaskId,
  setSelectedTaskId,
  openSelectedTask: openTaskModal,
});

window.addEventListener("resize", () => {
  clearTimeout(panelRenderTimer);
  panelRenderTimer = setTimeout(() => {
    renderAll({ preserveScroll: true });
  }, 120);
});

window.addEventListener("panel-layout-change", () => {
  followPanelLayoutTransition();
});

renderAll({ scrollToBottom: true });
