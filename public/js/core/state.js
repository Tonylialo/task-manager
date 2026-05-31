import { loadState, saveState } from "./store.js";

export const state = await loadState();

export function persist() {
  saveState(state);
}

export function getSortedDirections() {
  return [...state.directions].sort((a, b) => {
    const pa = Number(a.priority || 0);
    const pb = Number(b.priority || 0);

    if (pa !== pb) return pa - pb;

    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

export function setDirectionPriorityUnique(directionId, desiredPriority) {
  const desired = Math.max(1, Number(desiredPriority || 1));
  const directions = getSortedDirections();

  const target = directions.find(direction => direction.id === directionId);
  if (!target) return;

  const others = directions.filter(direction => direction.id !== directionId);

  const next = [
    ...others.slice(0, desired - 1),
    target,
    ...others.slice(desired - 1)
  ];

  next.forEach((direction, index) => {
    const real = state.directions.find(item => item.id === direction.id);
    if (real) real.priority = index + 1;
  });
}

export function reorderDirections(sourceId, targetId) {
  const sorted = getSortedDirections();

  const sourceIndex = sorted.findIndex(direction => direction.id === sourceId);
  const targetIndex = sorted.findIndex(direction => direction.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) return;

  const [moved] = sorted.splice(sourceIndex, 1);
  sorted.splice(targetIndex, 0, moved);

  sorted.forEach((direction, index) => {
    const real = state.directions.find(item => item.id === direction.id);
    if (real) real.priority = index + 1;
  });

  persist();
}
