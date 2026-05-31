import { els } from "../core/dom.js";
import { state, persist, getSortedDirections, setDirectionPriorityUnique } from "../core/state.js";
import { escapeHtml, escapeAttr, timeLeft } from "../core/utils.js";

let modalMode = null;
let editingId = null;
let onRender = () => {};
let nextDirectionPosition = null;
let presetTaskDirectionId = null;

export function setModalRenderCallback(callback) {
  onRender = callback;
}

export function bindModalEvents() {
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
  modalMode = "direction";
  editingId = id;
  nextDirectionPosition = position;

  const direction = id
    ? state.directions.find(item => item.id === id)
    : {
      title: "",
      symbol: "◌",
      color: "#5f6b55",
      priority: getSortedDirections().length + 1,
      goal: "",
      showAsTask: true
    };

  els.modalTitle.textContent = id ? "Редактировать направление" : "Создать направление";
  els.deleteBtn.style.display = id ? "inline-flex" : "none";
  els.saveBtn.style.display = "inline-flex";
  els.modalActions.style.display = "flex";

  els.modalForm.innerHTML = `
    <div class="direction-inline-row">
      <div class="field">
        <label>Символ</label>
        <input id="fieldSymbol" value="${escapeAttr(direction.symbol || "")}" placeholder="◌" />
      </div>

      <div class="field">
        <label>Название</label>
        <input id="fieldTitle" value="${escapeAttr(direction.title)}" placeholder="Например: Фриланс" />
      </div>

      <div class="field color-square-field">
        <label>Цвет</label>
        <button class="color-button" id="colorButton" type="button" style="--picked-color:${escapeAttr(direction.color || "#5f6b55")}"></button>
        <input id="fieldColor" type="color" value="${escapeAttr(direction.color || "#5f6b55")}" />
      </div>
    </div>

    <div class="field priority-input">
      <label>Приоритет</label>
      <div class="priority-control">
        <input id="fieldPriority" type="number" value="${escapeAttr(direction.priority || 1)}" />
        <div class="priority-arrows">
          <button type="button" id="priorityPlus" aria-label="Выше">↑</button>
          <button type="button" id="priorityMinus" aria-label="Ниже">↓</button>
        </div>
      </div>
    </div>

    <div class="switch-field">
      <div class="switch-text">
        <strong>Показывать в задачах</strong>
        <span>Если внутри направления нет задач, оно появится в списке задач.</span>
      </div>

      <label class="switch">
        <input id="fieldShowAsTask" type="checkbox" ${direction.showAsTask !== false ? "checked" : ""} />
        <i></i>
      </label>
    </div>

    <div class="field">
      <label>Цель направления</label>
      <textarea id="fieldGoal" placeholder="Что должно измениться?">${escapeHtml(direction.goal || "")}</textarea>
    </div>
  `;

  const colorInput = document.getElementById("fieldColor");
  const colorButton = document.getElementById("colorButton");
  const priorityInput = document.getElementById("fieldPriority");

  colorButton.addEventListener("click", () => colorInput.click());
  colorInput.addEventListener("input", () => {
    colorButton.style.setProperty("--picked-color", colorInput.value);
  });

  document.getElementById("priorityPlus").addEventListener("click", () => {
    priorityInput.value = Math.max(1, Number(priorityInput.value || 1) - 1);
  });

  document.getElementById("priorityMinus").addEventListener("click", () => {
    priorityInput.value = Number(priorityInput.value || 1) + 1;
  });

  els.modalBackdrop.classList.add("open");
}

export function openTaskModal(id = null, directionId = null) {
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

  els.modalTitle.textContent = id ? "Редактировать задачу" : "Создать задачу";
  els.deleteBtn.style.display = id ? "inline-flex" : "none";
  els.saveBtn.style.display = "inline-flex";
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
        <label>Направление</label>
        <select id="fieldDirection">${directionOptions}</select>
      </div>
    `;

  els.modalForm.innerHTML = `
    <div class="field">
      <label>Название задачи</label>
      <input id="fieldTitle" value="${escapeAttr(task.title)}" placeholder="Например: Монтаж видео" />
    </div>

    ${directionField}

    <div class="field">
      <label>Описание</label>
      <textarea id="fieldDescription" placeholder="Полное описание задачи">${escapeHtml(task.description || "")}</textarea>
    </div>

    <div class="field">
      <label>Goal / Final Result</label>
      <textarea id="fieldGoal" placeholder="Что должно получиться?">${escapeHtml(task.goal || "")}</textarea>
    </div>

    <div class="form-row">
      <div class="field">
        <label>Дедлайн</label>
        <input id="fieldDeadline" type="datetime-local" value="${escapeAttr(task.deadline || "")}" />
      </div>

      <div class="field priority-input">
        <label>Приоритет</label>
        <input id="fieldPriority" type="number" value="${escapeAttr(task.priority || 2)}" />
      </div>
    </div>
  `;

  els.modalBackdrop.classList.add("open");
}

export function openTaskViewModal(id) {
  modalMode = "view-task";
  editingId = id;

  const task = state.tasks.find(item => item.id === id);
  const direction = state.directions.find(item => item.id === task.directionId);

  els.modalTitle.textContent = "Просмотр задачи";
  els.deleteBtn.style.display = "none";
  els.saveBtn.style.display = "none";
  els.modalActions.style.display = "flex";

  els.modalForm.innerHTML = `
    <div class="view-block">
      <div class="view-line">
        <span class="view-label">Задача</span>
        <div class="view-value">${escapeHtml(task.title)}</div>
      </div>

      <div class="view-line">
        <span class="view-label">Направление</span>
        <div class="view-value">${escapeHtml(direction?.symbol || "◌")} ${escapeHtml(direction?.title || "Без направления")}</div>
      </div>

      ${task.description ? `
        <div class="view-line">
          <span class="view-label">Описание</span>
          <div class="view-value">${escapeHtml(task.description)}</div>
        </div>
      ` : ""}

      ${task.goal ? `
        <div class="view-line">
          <span class="view-label">Результат</span>
          <div class="view-value">${escapeHtml(task.goal)}</div>
        </div>
      ` : ""}

      <div class="view-line">
        <span class="view-label">Приоритет</span>
        <div class="view-value">${escapeHtml(task.priority || 2)}</div>
      </div>

      ${task.deadline ? `
        <div class="view-line">
          <span class="view-label">Дедлайн</span>
          <div class="view-value">${escapeHtml(task.deadline)} · ${escapeHtml(timeLeft(task.deadline))}</div>
        </div>
      ` : ""}
    </div>
  `;

  els.cancelBtn.textContent = "Закрыть";

  const editBtn = document.createElement("button");
  editBtn.className = "btn btn-primary";
  editBtn.textContent = "Редактировать";
  editBtn.onclick = () => openTaskModal(id);

  const right = els.modalActions.querySelector(".modal-actions-right");
  right.insertBefore(editBtn, els.saveBtn);

  els.modalBackdrop.classList.add("open");
}

export function closeModal() {
  els.modalBackdrop.classList.remove("open");
  modalMode = null;
  editingId = null;
  nextDirectionPosition = null;
  presetTaskDirectionId = null;

  els.cancelBtn.textContent = "Отмена";

  const extraEditButton = els.modalActions.querySelector(".modal-actions-right .btn-primary:not(#saveBtn)");
  if (extraEditButton) extraEditButton.remove();

  els.saveBtn.style.display = "inline-flex";
  els.deleteBtn.style.display = "inline-flex";
  els.modalActions.style.display = "flex";
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
  const data = {
    title: document.getElementById("fieldTitle").value.trim() || "Untitled task",
    directionId: document.getElementById("fieldDirection").value || presetTaskDirectionId,
    description: document.getElementById("fieldDescription").value.trim(),
    goal: document.getElementById("fieldGoal").value.trim(),
    deadline: document.getElementById("fieldDeadline").value,
    priority: Number(document.getElementById("fieldPriority").value || 2)
  };

  if (editingId) {
    const task = state.tasks.find(item => item.id === editingId);
    Object.assign(task, data);
  } else {
    state.tasks.push({
      id: crypto.randomUUID(),
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
