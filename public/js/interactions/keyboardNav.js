import { els } from "../core/dom.js";
import { state, getSortedDirections } from "../core/state.js";
import { closeModal } from "../render/modals.js";

let currentSelectedId = null;
let updateHighlightCallback = null;

export function bindKeyboardNavigation({
  getMode,
  getSelectedDirectionId,
  setSelectedDirectionId,
  enterFocusMode,
  exitFocusMode,
  centerOnDirection,
  getFocusedTasks,
  getSelectedTaskId,
  setSelectedTaskId,
  openSelectedTask,
}) {
  function updateSelectionHighlight() {
    document.querySelectorAll(".direction-node").forEach((card) => {
      card.classList.toggle("selected", card.dataset.id === currentSelectedId);
    });
  }

  updateHighlightCallback = updateSelectionHighlight;

  document.addEventListener("keydown", (event) => {
    if (els.modalBackdrop.classList.contains("open")) {
      if (event.key === "Escape") closeModal();
      return;
    }

    if (isTyping(event.target)) return;

    const mode = getMode?.() || "idle";

    if (mode === "focus") {
      handleFocusKeys(event, {
        exitFocusMode,
        getFocusedTasks,
        getSelectedTaskId,
        setSelectedTaskId,
        openSelectedTask,
      });
      return;
    }

    if (state.viewMode !== "canvas" && state.viewMode !== "list") return;

    const directions = getSortedDirections();
    if (!directions.length) return;

    currentSelectedId = getSelectedDirectionId?.() || currentSelectedId;

    const currentIndex = currentSelectedId
      ? directions.findIndex((direction) => direction.id === currentSelectedId)
      : -1;

    if (event.key === "ArrowUp") {
      event.preventDefault();

      const nextIndex = currentIndex < 0
        ? 0
        : Math.min(currentIndex + 1, directions.length - 1);

      currentSelectedId = directions[nextIndex].id;
      setSelectedDirectionId(currentSelectedId);
      updateSelectionHighlight();
      centerOnDirection(currentSelectedId);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();

      const nextIndex = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0);

      currentSelectedId = directions[nextIndex].id;
      setSelectedDirectionId(currentSelectedId);
      updateSelectionHighlight();
      centerOnDirection(currentSelectedId);
    } else if (event.key === "Enter") {
      if (!currentSelectedId) return;

      event.preventDefault();
      enterFocusMode(currentSelectedId);
    } else if (event.key === "Escape") {
      if (!currentSelectedId) return;

      event.preventDefault();
      currentSelectedId = null;
      setSelectedDirectionId(null, { center: false });
      updateSelectionHighlight();
    }
  });

  setTimeout(() => updateSelectionHighlight(), 50);
}

function handleFocusKeys(
  event,
  {
    exitFocusMode,
    getFocusedTasks,
    getSelectedTaskId,
    setSelectedTaskId,
    openSelectedTask,
  },
) {
  const tasks = getFocusedTasks?.() || [];
  const selectedTaskId = getSelectedTaskId?.();
  const currentIndex = selectedTaskId
    ? tasks.findIndex((task) => task.id === selectedTaskId)
    : -1;

  if (event.key === "Escape") {
    event.preventDefault();
    exitFocusMode?.({ keepSelection: true });
    return;
  }

  if (!tasks.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    const nextIndex = currentIndex < 0
      ? 0
      : Math.min(currentIndex + 1, tasks.length - 1);
    setSelectedTaskId?.(tasks[nextIndex].id);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    const nextIndex = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0);
    setSelectedTaskId?.(tasks[nextIndex].id);
  } else if (event.key === "Enter") {
    if (!selectedTaskId) return;

    event.preventDefault();
    openSelectedTask?.(selectedTaskId);
  }
}

function isTyping(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}

export function syncSelectionFromOutside(selectedId) {
  currentSelectedId = selectedId;

  if (updateHighlightCallback) {
    updateHighlightCallback();
  }
}
