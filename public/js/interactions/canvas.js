import { els } from "../core/dom.js";
import { state } from "../core/state.js";

export function applyView() {
  if (!state.view) {
    state.view = {
      x: 0,
      y: 0,
      scale: 1,
    };
  }

  state.view.x = 0;
  state.view.y = 0;
  state.view.scale = 1;

  els.world.style.transform = "none";
  els.world.style.transformOrigin = "0 0";
}

export function bindCanvas() {
  els.workspace.addEventListener(
    "wheel",
    () => {
      // Keep native vertical scrolling enabled.
    },
    { passive: true },
  );
}

export function clientToWorld(clientX, clientY) {
  const rect = els.canvas.getBoundingClientRect();

  return {
    x: Math.round(clientX - rect.left),
    y: Math.round(clientY - rect.top + els.workspace.scrollTop),
  };
}
