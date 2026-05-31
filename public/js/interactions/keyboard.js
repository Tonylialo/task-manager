import { els } from "../core/dom.js";
import { isTyping } from "../core/utils.js";

export function bindKeyboard({ closeModal }) {
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();

    if (event.code === "Space" && !isTyping() && !els.modalBackdrop.classList.contains("open")) {
      event.preventDefault();
      els.sidebar.classList.toggle("full-collapsed");
    }
  });
}
