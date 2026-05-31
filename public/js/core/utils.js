export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttr(value) {
  return escapeHtml(value);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function isTyping() {
  const tag = document.activeElement?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export function timeLeft(deadline) {
  const diff = new Date(deadline) - new Date();

  if (diff <= 0) return "late";

  const hours = Math.floor(diff / 36e5);
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;

  if (hours < 24) return `${hours}h`;
  return `${days}d ${restHours}h`;
}
