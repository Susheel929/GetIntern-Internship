const STORAGE_KEY = "blockspace-zero-framework-v1";

const DEFAULT_STATE = {
  columns: [
    { id: "col-backlog", title: "Backlog", cards: [
      { id: "task-1", title: "Define the workspace structure", description: "Map the columns, cards, and state model before coding.", completed: false },
      { id: "task-2", title: "Design the card block", description: "Keep the UI lightweight and editable in place.", completed: false }
    ]},
    { id: "col-progress", title: "In Progress", cards: [
      { id: "task-3", title: "Implement drag and drop", description: "Use dragstart, dragover, drop, and dragleave with native HTML5 APIs.", completed: false }
    ]},
    { id: "col-done", title: "Done", cards: [
      { id: "task-4", title: "Create the base HTML shell", description: "No framework, no build tool, no external dependency.", completed: true }
    ]}
  ]
};

const state = loadState();
const els = {
  board: document.querySelector("#board"),
  taskCount: document.querySelector("#task-count"),
  columnCount: document.querySelector("#column-count"),
  completedCount: document.querySelector("#completed-count"),
  saveStatus: document.querySelector("#save-status"),
  template: document.querySelector("#card-template"),
  addColumn: document.querySelector("#add-column"),
  addCardTop: document.querySelector("#add-card-top"),
  resetBoard: document.querySelector("#reset-board")
};

let draggedCardId = null;
let draggedSourceColumnId = null;
let dragPlaceholder = null;

render();

els.addColumn.addEventListener("click", () => {
  const column = {
    id: makeId("col"),
    title: "New column",
    cards: []
  };
  state.columns.push(column);
  saveState();
  render();
  focusColumn(column.id);
});

els.addCardTop.addEventListener("click", () => {
  const target = state.columns[0];
  if (!target) return;
  const card = createCard("New task", "Add a description…");
  target.cards.push(card);
  saveState();
  render();
  focusCardTitle(card.id);
});

els.resetBoard.addEventListener("click", () => {
  const confirmed = window.confirm("Reset the workspace to its starter state?");
  if (!confirmed) return;
  const fresh = structuredClone(DEFAULT_STATE);
  state.columns = fresh.columns;
  saveState();
  render();
});

function createCard(title = "New task", description = "Add a description…") {
  return { id: makeId("task"), title, description, completed: false };
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.columns)) throw new Error("Invalid state");
    return parsed;
  } catch (error) {
    console.warn("Could not load saved state; using defaults.", error);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.saveStatus.textContent = "Saved locally";
  window.clearTimeout(saveState._timer);
  els.saveStatus.dataset.state = "saved";
}

function render() {
  const fragment = document.createDocumentFragment();

  state.columns.forEach(column => fragment.appendChild(renderColumn(column)));

  els.board.replaceChildren(fragment);
  updateStats();
}

function renderColumn(column) {
  const columnEl = document.createElement("section");
  columnEl.className = "column";
  columnEl.dataset.columnId = column.id;
  columnEl.innerHTML = `
    <div class="column-header">
      <div class="column-title" contenteditable="true" spellcheck="false" role="textbox" aria-label="Column title"></div>
      <span class="column-count"></span>
      <button class="column-delete" type="button" aria-label="Delete column">×</button>
    </div>
    <div class="card-list"></div>
    <button class="add-card" type="button">+ Add task</button>
  `;

  const titleEl = columnEl.querySelector(".column-title");
  titleEl.textContent = column.title;
  titleEl.addEventListener("blur", () => {
    column.title = cleanText(titleEl.textContent) || "Untitled";
    titleEl.textContent = column.title;
    saveState();
  });
  titleEl.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      titleEl.blur();
    }
  });

  columnEl.querySelector(".column-delete").addEventListener("click", () => {
    if (state.columns.length === 1) {
      window.alert("Keep at least one column on the board.");
      return;
    }
    const confirmed = window.confirm(`Delete “${column.title}” and its ${column.cards.length} task(s)?`);
    if (!confirmed) return;
    state.columns = state.columns.filter(item => item.id !== column.id);
    saveState();
    render();
  });

  const cardList = columnEl.querySelector(".card-list");
  const cardsFragment = document.createDocumentFragment();
  column.cards.forEach(card => cardsFragment.appendChild(renderCard(card, column.id)));
  cardList.appendChild(cardsFragment);

  const addCardButton = columnEl.querySelector(".add-card");
  addCardButton.addEventListener("click", () => {
    const card = createCard();
    column.cards.push(card);
    saveState();
    render();
    focusCardTitle(card.id);
  });

  attachDropEvents(columnEl, cardList, column.id);
  columnEl.querySelector(".column-count").textContent = column.cards.length;

  return columnEl;
}

function renderCard(card, columnId) {
  const cardEl = els.template.content.firstElementChild.cloneNode(true);
  cardEl.dataset.cardId = card.id;
  cardEl.dataset.columnId = columnId;
  cardEl.classList.toggle("completed", Boolean(card.completed));

  const titleEl = cardEl.querySelector(".task-title");
  const descriptionEl = cardEl.querySelector(".task-description");
  const statusButton = cardEl.querySelector(".status-button");
  const deleteButton = cardEl.querySelector(".delete-card");

  titleEl.textContent = card.title;
  descriptionEl.textContent = card.description;
  cardEl.querySelector(".task-id").textContent = `#${card.id.slice(-5)}`;

  bindEditable(titleEl, value => {
    card.title = value || "Untitled task";
  });
  bindEditable(descriptionEl, value => {
    card.description = value;
  });

  statusButton.classList.toggle("done", card.completed);
  statusButton.textContent = card.completed ? "✓" : "○";
  statusButton.addEventListener("click", event => {
    event.stopPropagation();
    card.completed = !card.completed;
    saveState();
    render();
  });

  deleteButton.addEventListener("click", event => {
    event.stopPropagation();
    const column = findColumn(columnId);
    if (!column) return;
    column.cards = column.cards.filter(item => item.id !== card.id);
    saveState();
    render();
  });

  cardEl.addEventListener("dragstart", event => {
    draggedCardId = card.id;
    draggedSourceColumnId = columnId;
    cardEl.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.id);
  });

  cardEl.addEventListener("dragend", () => {
    cardEl.classList.remove("dragging");
    cleanupPlaceholder();
    document.querySelectorAll(".column.drag-over").forEach(el => el.classList.remove("drag-over"));
    draggedCardId = null;
    draggedSourceColumnId = null;
  });

  return cardEl;
}

function bindEditable(element, onChange) {
  element.addEventListener("blur", () => {
    onChange(cleanText(element.textContent));
    saveState();
  });
  element.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      element.blur();
    }
  });
}

function attachDropEvents(columnEl, cardList, columnId) {
  columnEl.addEventListener("dragover", event => {
    if (!draggedCardId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    columnEl.classList.add("drag-over");

    const afterCard = getCardAfterPointer(cardList, event.clientY);
    ensurePlaceholder(cardList);
    if (afterCard) cardList.insertBefore(dragPlaceholder, afterCard);
    else cardList.appendChild(dragPlaceholder);
  });

  columnEl.addEventListener("dragleave", event => {
    if (!columnEl.contains(event.relatedTarget)) {
      columnEl.classList.remove("drag-over");
      cleanupPlaceholder();
    }
  });

  columnEl.addEventListener("drop", event => {
    event.preventDefault();
    if (!draggedCardId) return;

    const targetColumn = findColumn(columnId);
    const sourceColumn = findColumn(draggedSourceColumnId);
    if (!targetColumn || !sourceColumn) return;

    const draggedCard = sourceColumn.cards.find(card => card.id === draggedCardId);
    if (!draggedCard) return;

    sourceColumn.cards = sourceColumn.cards.filter(card => card.id !== draggedCardId);

    const afterCardEl = getCardAfterPointer(cardList, event.clientY);
    const targetIndex = afterCardEl
      ? targetColumn.cards.findIndex(card => card.id === afterCardEl.dataset.cardId)
      : targetColumn.cards.length;

    const safeIndex = targetIndex < 0 ? targetColumn.cards.length : targetIndex;
    targetColumn.cards.splice(safeIndex, 0, draggedCard);

    columnEl.classList.remove("drag-over");
    cleanupPlaceholder();
    saveState();
    render();
  });
}

function getCardAfterPointer(cardList, mouseY) {
  const cards = [...cardList.querySelectorAll(".task-card:not(.dragging)")];
  return cards.reduce((closest, card) => {
    const rect = card.getBoundingClientRect();
    const offset = mouseY - rect.top - rect.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: card };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function ensurePlaceholder(cardList) {
  if (!dragPlaceholder) {
    dragPlaceholder = document.createElement("div");
    dragPlaceholder.className = "drop-placeholder";
  }
  if (dragPlaceholder.parentElement !== cardList) cardList.appendChild(dragPlaceholder);
}

function cleanupPlaceholder() {
  dragPlaceholder?.remove();
}

function findColumn(id) {
  return state.columns.find(column => column.id === id);
}

function findCard(id) {
  for (const column of state.columns) {
    const card = column.cards.find(item => item.id === id);
    if (card) return card;
  }
  return null;
}

function updateStats() {
  const cards = state.columns.flatMap(column => column.cards);
  const completed = cards.filter(card => card.completed).length;
  els.taskCount.textContent = cards.length;
  els.columnCount.textContent = state.columns.length;
  els.completedCount.textContent = cards.length ? `${Math.round((completed / cards.length) * 100)}%` : "0%";
}

function cleanText(value) {
  return value.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function focusCardTitle(cardId) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-card-id="${CSS.escape(cardId)}"] .task-title`);
    if (!el) return;
    el.focus();
    placeCaretAtEnd(el);
  });
}

function focusColumn(columnId) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-column-id="${CSS.escape(columnId)}"] .column-title`);
    if (!el) return;
    el.focus();
    placeCaretAtEnd(el);
  });
}

function placeCaretAtEnd(element) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

// Expose state for learning/debugging in DevTools.
window.Blockspace = { state, saveState, render, findCard, findColumn };
