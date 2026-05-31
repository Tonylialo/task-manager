const STORAGE_KEY = "kuro-task-manager-v6";

const fallbackState = {
  viewMode: "canvas",
  view: {
    x: 0,
    y: 0,
    scale: 1
  },
  directions: [],
  tasks: [],
  notifications: []
};

export async function loadState() {
  try {
    const response = await fetch("/api/db", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("API db unavailable");
    }

    const data = await response.json();
    return normalizeState(data);
  } catch (error) {
    console.warn("Server DB unavailable, fallback to localStorage:", error);

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(fallbackState);

    return normalizeState(JSON.parse(raw));
  }
}

export async function saveState(state) {
  const clean = normalizeState(state);

  try {
    const response = await fetch("/api/db", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(clean)
    });

    if (!response.ok) {
      throw new Error("Failed to save server DB");
    }
  } catch (error) {
    console.warn("Server save unavailable, fallback to localStorage:", error);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  }
}

export function normalizeState(data) {
  const normalized = {
    ...fallbackState,
    ...data
  };

  normalized.view = {
    ...fallbackState.view,
    ...(data?.view || {})
  };

  normalized.viewMode = normalized.viewMode === "list" ? "list" : "canvas";

  normalized.directions = (normalized.directions || []).map((direction, index) => ({
    id: direction.id || crypto.randomUUID(),
    title: direction.title || "Untitled direction",
    symbol: direction.symbol || "◌",
    color: direction.color || "#8f9bff",
    priority: Number(direction.priority || index + 1),
    goal: direction.goal || "",
    showAsTask: direction.showAsTask !== false,
    x: Number(direction.x || 400 + index * 140),
    y: Number(direction.y || 300 + index * 120)
  }));

  normalized.tasks = (normalized.tasks || []).map(task => ({
    id: task.id || crypto.randomUUID(),
    directionId: task.directionId || "",
    title: task.title || "Untitled task",
    description: task.description || "",
    goal: task.goal || "",
    deadline: task.deadline || "",
    priority: Number(task.priority || 2)
  }));

  normalized.notifications = (normalized.notifications || []).map(item => ({
    id: item.id || crypto.randomUUID(),
    title: item.title || "Уведомление",
    text: item.text || "",
    read: Boolean(item.read)
  }));

  return normalized;
}
