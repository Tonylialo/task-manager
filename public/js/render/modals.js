import { els } from "../core/dom.js";
import { state, persist, getSortedDirections, setDirectionPriorityUnique } from "../core/state.js";
import { escapeHtml, escapeAttr } from "../core/utils.js";

let modalMode = null;
let editingId = null;
let onRender = () => {};
let nextDirectionPosition = null;
let presetTaskDirectionId = null;

export function setModalRenderCallback(callback) {
  onRender = callback;
}

export function bindModalEvents() {
  els.saveBtn.textContent = "Save";
  els.deleteBtn.textContent = "Delete";
  els.cancelBtn.textContent = "Cancel";
  els.closeModalBtn.setAttribute("aria-label", "Close");

  els.saveBtn.addEventListener("click", () => {
    if (modalMode === "direction") saveDirectionFromModal();
    if (modalMode === "task") saveTaskFromModal();
  });

  els.deleteBtn.addEventListener("click", deleteCurrentEntity);
  els.cancelBtn.addEventListener("click", closeModal);
  els.closeModalBtn.addEventListener("click", closeModal);

  els.modalBackdrop.addEventListener("click", event => {
    if (event.target === els.modalBackdrop) closeModal();
  });
}

export function openDirectionModal(id = null, position = null) {
  resetActionButtons();
  modalMode = "direction";
  editingId = id;
  nextDirectionPosition = position;

  const sortedDirections = getSortedDirections();
  const maxPriority = id ? Math.max(1, sortedDirections.length) : Math.max(1, sortedDirections.length + 1);

  const direction = id
    ? state.directions.find(item => item.id === id)
    : {
      title: "",
      symbol: "◌",
      color: "#5f6b55",
      priority: maxPriority,
      goal: "",
      showAsTask: true
    };

  els.modalTitle.textContent = id ? "Edit direction" : "Create direction";
  els.deleteBtn.style.display = id ? "inline-flex" : "none";
  els.saveBtn.style.display = "inline-flex";
  els.cancelBtn.style.display = "inline-flex";
  els.modalActions.style.display = "flex";

  els.modalForm.innerHTML = `
    <div class="direction-inline-row">
      <div class="field">
        <label>Symbol</label>
        <input id="fieldSymbol" value="${escapeAttr(direction.symbol || "")}" placeholder="◌" />
      </div>

      <div class="field">
        <label>Name</label>
        <input id="fieldTitle" value="${escapeAttr(direction.title)}" placeholder="Example: Freelance" />
      </div>

      <div class="field color-square-field">
        <label>Color</label>
        <button class="color-button" id="colorButton" type="button" style="--picked-color:${escapeAttr(direction.color || "#5f6b55")}"></button>
        <input id="fieldColor" type="color" value="${escapeAttr(direction.color || "#5f6b55")}" />
      </div>
    </div>

    <div class="field priority-input">
      <label>Priority</label>
      <div class="priority-control custom-priority-control" data-max-priority="${maxPriority}">
        <button type="button" class="priority-step" id="priorityUp" aria-label="Move higher">↑</button>
        <input id="fieldPriority" inputmode="numeric" value="${escapeAttr(direction.priority || maxPriority)}" readonly />
        <button type="button" class="priority-step" id="priorityDown" aria-label="Move lower">↓</button>
      </div>
      <small class="priority-hint">Changing this number shifts the other directions automatically after saving.</small>
    </div>

    <div class="switch-field">
      <div class="switch-text">
        <strong>Show in tasks</strong>
        <span>If this direction has no tasks, it appears in the task list.</span>
      </div>

      <label class="switch">
        <input id="fieldShowAsTask" type="checkbox" ${direction.showAsTask !== false ? "checked" : ""} />
        <i></i>
      </label>
    </div>

    <div class="field">
      <label>Direction goal</label>
      <textarea id="fieldGoal" placeholder="What should change?">${escapeHtml(direction.goal || "")}</textarea>
    </div>
  `;

  const colorInput = document.getElementById("fieldColor");
  const colorButton = document.getElementById("colorButton");
  const priorityInput = document.getElementById("fieldPriority");

  colorButton.addEventListener("click", () => colorInput.click());
  colorInput.addEventListener("input", () => {
    colorButton.style.setProperty("--picked-color", colorInput.value);
  });

  bindCounter({
    input: priorityInput,
    up: document.getElementById("priorityUp"),
    down: document.getElementById("priorityDown"),
    min: 1,
    max: maxPriority,
    upMeans: -1,
  });

  els.modalBackdrop.classList.add("open");
}

export function openTaskModal(id = null, directionId = null) {
  resetActionButtons();
  modalMode = "task";
  editingId = id;
  presetTaskDirectionId = directionId;

  if (!state.directions.length) {
    openDirectionModal();
    return;
  }

  const task = id
    ? state.tasks.find(item => item.id === id)
    : {
      title: "",
      directionId: directionId || state.directions[0]?.id || "",
      description: "",
      goal: "",
      deadline: "",
      priority: 2
    };

  const selectedDirectionId = directionId || task.directionId;
  const deadline = splitDeadline(task.deadline);

  els.modalTitle.textContent = id ? "Edit task" : "Create task";
  els.deleteBtn.style.display = id ? "inline-flex" : "none";
  els.saveBtn.style.display = "inline-flex";
  els.cancelBtn.style.display = "none";
  els.modalActions.style.display = "flex";

  const directionOptions = state.directions.map(direction => {
    return `
      <option value="${direction.id}" ${selectedDirectionId === direction.id ? "selected" : ""}>
        ${escapeHtml(direction.symbol || "◌")} ${escapeHtml(direction.title)}
      </option>
    `;
  }).join("");

  const directionField = directionId && !id
    ? `<input id="fieldDirection" type="hidden" value="${escapeAttr(directionId)}" />`
    : `
      <div class="field">
        <label>Direction</label>
        <select id="fieldDirection">${directionOptions}</select>
      </div>
    `;

  els.modalForm.innerHTML = `
    <div class="field">
      <label>Task name</label>
      <input id="fieldTitle" value="${escapeAttr(task.title)}" placeholder="Example: Edit video" />
    </div>

    ${directionField}

    <div class="field">
      <label>Description</label>
      <textarea id="fieldDescription" placeholder="Full task description">${escapeHtml(task.description || "")}</textarea>
    </div>

    <div class="field">
      <label>Goal / final result</label>
      <textarea id="fieldGoal" placeholder="What should be done?">${escapeHtml(task.goal || "")}</textarea>
    </div>

    <div class="form-row">
      <div class="field deadline-field">
        <label>Deadline</label>
        <div class="deadline-parts">
          <input id="deadlineDay" inputmode="numeric" maxlength="2" placeholder="DD" value="${escapeAttr(deadline.day)}" />
          <input id="deadlineMonth" inputmode="numeric" maxlength="2" placeholder="MM" value="${escapeAttr(deadline.month)}" />
          <input id="deadlineYear" inputmode="numeric" maxlength="2" placeholder="YY" value="${escapeAttr(deadline.year)}" />
          <input id="deadlineTime" type="time" step="60" value="${escapeAttr(deadline.time)}" />
        </div>
        <small>Day only means the current month and year. Empty time means 23:59.</small>
      </div>

      <div class="field priority-input">
        <label>Priority</label>
        <div class="priority-control custom-priority-control task-priority-control">
          <button type="button" class="priority-step" id="taskPriorityDown" aria-label="Lower priority">↓</button>
          <input id="fieldPriority" inputmode="numeric" value="${escapeAttr(task.priority || 2)}" readonly />
          <button type="button" class="priority-step" id="taskPriorityUp" aria-label="Higher priority">↑</button>
        </div>
      </div>
    </div>
  `;

  bindCounter({
    input: document.getElementById("fieldPriority"),
    up: document.getElementById("taskPriorityUp"),
    down: document.getElementById("taskPriorityDown"),
    min: 1,
    max: 99,
    upMeans: 1,
  });

  els.modalBackdrop.classList.add("open");
}

export function openTaskViewModal(id) {
  openTaskModal(id);
}

export function closeModal() {
  els.modalBackdrop.classList.remove("open");
  modalMode = null;
  editingId = null;
  nextDirectionPosition = null;
  presetTaskDirectionId = null;
  resetActionButtons();
}

function resetActionButtons() {
  els.cancelBtn.textContent = "Cancel";
  els.saveBtn.textContent = "Save";
  els.deleteBtn.textContent = "Delete";
  els.cancelBtn.style.display = "inline-flex";
  els.saveBtn.style.display = "inline-flex";
  els.deleteBtn.style.display = "inline-flex";
  els.modalActions.style.display = "flex";

  const extraEditButton = els.modalActions.querySelector(".modal-actions-right .btn-primary:not(#saveBtn)");
  if (extraEditButton) extraEditButton.remove();
}

function saveDirectionFromModal() {
  const desiredPriority = Number(document.getElementById("fieldPriority").value || 1);

  const data = {
    title: document.getElementById("fieldTitle").value.trim() || "Untitled direction",
    goal: document.getElementById("fieldGoal").value.trim(),
    symbol: document.getElementById("fieldSymbol").value.trim() || "◌",
    color: document.getElementById("fieldColor").value,
    priority: desiredPriority,
    showAsTask: document.getElementById("fieldShowAsTask").checked
  };

  let id = editingId;

  if (editingId) {
    const direction = state.directions.find(item => item.id === editingId);
    Object.assign(direction, data);
  } else {
    id = crypto.randomUUID();

    state.directions.push({
      id,
      ...data,
      x: nextDirectionPosition?.x ?? Math.round((window.innerWidth * 0.28 - state.view.x) / state.view.scale),
      y: nextDirectionPosition?.y ?? Math.round((window.innerHeight * 0.42 - state.view.y) / state.view.scale)
    });
  }

  setDirectionPriorityUnique(id, desiredPriority);
  persist();
  closeModal();
  onRender();
}

function saveTaskFromModal() {
  const deadline = buildDeadlineFromFields();
  if (deadline === null) return;

  const data = {
    title: document.getElementById("fieldTitle").value.trim() || "Untitled task",
    directionId: document.getElementById("fieldDirection").value || presetTaskDirectionId,
    description: document.getElementById("fieldDescription").value.trim(),
    goal: document.getElementById("fieldGoal").value.trim(),
    deadline,
    priority: Number(document.getElementById("fieldPriority").value || 2)
  };

  if (editingId) {
    const task = state.tasks.find(item => item.id === editingId);
    Object.assign(task, data, { updatedAt: new Date().toISOString() });
  } else {
    const now = new Date().toISOString();
    state.tasks.push({
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...data
    });
  }

  persist();
  closeModal();
  onRender();
}

function deleteCurrentEntity() {
  if (!editingId) return;

  if (modalMode === "direction") {
    state.directions = state.directions.filter(direction => direction.id !== editingId);
    state.tasks = state.tasks.filter(task => task.directionId !== editingId);
  }

  if (modalMode === "task") {
    state.tasks = state.tasks.filter(task => task.id !== editingId);
  }

  persist();
  closeModal();
  onRender();
}

function splitDeadline(value) {
  if (!value) return { day: "", month: "", year: "", time: "" };

  const [datePart, timePart = ""] = String(value).split("T");
  const [year = "", month = "", day = ""] = datePart.split("-");

  return {
    day,
    month,
    year: year ? year.slice(-2) : "",
    time: timePart ? timePart.slice(0, 5) : "",
  };
}

function buildDeadlineFromFields() {
  const dayRaw = document.getElementById("deadlineDay")?.value.trim() || "";
  const monthRaw = document.getElementById("deadlineMonth")?.value.trim() || "";
  const yearRaw = document.getElementById("deadlineYear")?.value.trim() || "";
  const timeRaw = document.getElementById("deadlineTime")?.value.trim() || "";

  if (!dayRaw && !monthRaw && !yearRaw && !timeRaw) return "";

  if (!dayRaw) {
    alert("Please enter the deadline day.");
    return null;
  }

  const now = new Date();
  const day = Number(dayRaw);
  const month = monthRaw ? Number(monthRaw) : now.getMonth() + 1;
  const year = yearRaw ? 2000 + Number(yearRaw) : now.getFullYear();
  const time = timeRaw || "23:59";

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    alert("Check the deadline day.");
    return null;
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    alert("Check the deadline month.");
    return null;
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    alert("Check the deadline time.");
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    alert("This date does not exist.");
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${time}`;
}

function bindCounter({ input, up, down, min = 1, max = 99, upMeans = 1 }) {
  const clamp = (value) => Math.max(min, Math.min(max, Number(value || min)));

  function setValue(value) {
    input.value = String(clamp(value));
  }

  up.addEventListener("click", () => setValue(Number(input.value || min) + upMeans));
  down.addEventListener("click", () => setValue(Number(input.value || min) - upMeans));
}
