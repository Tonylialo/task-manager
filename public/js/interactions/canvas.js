import { els } from "../core/dom.js";
import { state, persist } from "../core/state.js";
import { clamp } from "../core/utils.js";

const pan = {
  active: false,
  x: 0,
  y: 0,
  viewX: 0,
  viewY: 0
};

export function applyView() {
  if (state.viewMode === "list") {
    els.world.style.transform = "none";
    return;
  }

  els.world.style.transform = `translate(${state.view.x}px, ${state.view.y}px) scale(${state.view.scale})`;
}

export function bindCanvas() {
  els.canvas.addEventListener("pointerdown", event => {
    if (state.viewMode === "list") return;
    if (event.button !== 0) return;

    pan.active = true;
    pan.x = event.clientX;
    pan.y = event.clientY;
    pan.viewX = state.view.x;
    pan.viewY = state.view.y;

    els.canvas.setPointerCapture(event.pointerId);
  });

  els.canvas.addEventListener("pointermove", event => {
    if (state.viewMode === "list") return;
    if (!pan.active) return;

    state.view.x = pan.viewX + event.clientX - pan.x;
    state.view.y = pan.viewY + event.clientY - pan.y;

    applyView();
  });

  els.canvas.addEventListener("pointerup", () => {
    pan.active = false;
    persist();
  });

  els.canvas.addEventListener("wheel", event => {
    if (state.viewMode === "list") return;

    event.preventDefault();

    const rect = els.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const oldScale = state.view.scale;
    const zoom = event.deltaY < 0 ? 1.08 : 0.92;
    const newScale = clamp(oldScale * zoom, 0.35, 1.8);

    const worldX = (mouseX - state.view.x) / oldScale;
    const worldY = (mouseY - state.view.y) / oldScale;

    state.view.scale = newScale;
    state.view.x = mouseX - worldX * newScale;
    state.view.y = mouseY - worldY * newScale;

    applyView();
    persist();
  }, { passive: false });
}
