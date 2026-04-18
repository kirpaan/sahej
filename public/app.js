const state = {
  data: {
    sessions: [],
    notes: [],
    actions: [],
  },
  selectedSessionId: null,
  aiMode: "local-fallback",
};

const elements = {
  sessionList: document.getElementById("session-list"),
  statsGrid: document.getElementById("stats-grid"),
  chatThread: document.getElementById("chat-thread"),
  reportView: document.getElementById("report-view"),
  actionList: document.getElementById("action-list"),
  noteList: document.getElementById("note-list"),
  reportSessionLabel: document.getElementById("report-session-label"),
  aiBadge: document.getElementById("ai-badge"),
  modeSelect: document.getElementById("mode-select"),
  chatForm: document.getElementById("chat-form"),
  chatInput: document.getElementById("chat-input"),
  noteForm: document.getElementById("note-form"),
  noteTitle: document.getElementById("note-title"),
  noteContent: document.getElementById("note-content"),
};

elements.chatForm.addEventListener("submit", onChatSubmit);
elements.noteForm.addEventListener("submit", onNoteSubmit);

void loadState();

async function loadState() {
  const response = await fetch("/api/state");
  state.data = await response.json();

  if (!state.selectedSessionId && state.data.sessions.length) {
    state.selectedSessionId = state.data.sessions[0].id;
  }

  render();
}

async function onChatSubmit(event) {
  event.preventDefault();
  const message = elements.chatInput.value.trim();
  if (!message) {
    return;
  }

  setChatPending(true);

  const response = await fetch("/api/reflect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: state.selectedSessionId,
      mode: elements.modeSelect.value,
      message,
    }),
  });

  const payload = await response.json();
  state.data = payload.state;
  state.aiMode = payload.aiMode;
  state.selectedSessionId = payload.session.id;
  elements.chatInput.value = "";
  render();
  setChatPending(false);
}

async function onNoteSubmit(event) {
  event.preventDefault();
  const title = elements.noteTitle.value.trim();
  const content = elements.noteContent.value.trim();
  if (!content) {
    return;
  }

  const response = await fetch("/api/notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, content }),
  });

  const payload = await response.json();
  state.data = payload.state;
  elements.noteTitle.value = "";
  elements.noteContent.value = "";
  render();
}

async function updateActionStatus(id, status) {
  const response = await fetch("/api/actions/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, status }),
  });

  const payload = await response.json();
  state.data = payload.state;
  render();
}

function render() {
  renderStats();
  renderSessions();
  renderChat();
  renderReport();
  renderNotes();
  renderActions();
  elements.aiBadge.textContent = state.aiMode === "ollama" ? "Ollama live" : "Local fallback";
}

function renderStats() {
  const sessions = state.data.sessions.length;
  const notes = state.data.notes.length;
  const openActions = state.data.actions.filter((item) => item.status !== "done").length;
  const doneActions = state.data.actions.filter((item) => item.status === "done").length;
  const alignment =
    state.data.actions.length > 0
      ? `${Math.round((doneActions / state.data.actions.length) * 100)}%`
      : "0%";

  const stats = [
    { label: "Sessions", value: sessions },
    { label: "Notes", value: notes },
    { label: "Open actions", value: openActions },
    { label: "Alignment", value: alignment },
  ];

  elements.statsGrid.innerHTML = stats
    .map(
      (item) => `
        <article class="stat-card">
          <strong>${item.value}</strong>
          <span class="meta">${item.label}</span>
        </article>
      `
    )
    .join("");
}

function renderSessions() {
  if (!state.data.sessions.length) {
    elements.sessionList.className = "session-list empty-state";
    elements.sessionList.textContent = "No sessions yet. Start a reflection or project chat.";
    return;
  }

  elements.sessionList.className = "session-list";
  elements.sessionList.innerHTML = state.data.sessions
    .map((session) => {
      const activeClass = session.id === state.selectedSessionId ? "active" : "";
      return `
        <article class="session-card ${activeClass}" data-session-id="${session.id}">
          <p class="eyebrow">${session.mode}</p>
          <h3>${escapeHtml(session.title)}</h3>
          <p>${escapeHtml(session.report?.summary || "Awaiting first report.")}</p>
          <span class="meta">${formatDate(session.updatedAt)}</span>
        </article>
      `;
    })
    .join("");

  [...elements.sessionList.querySelectorAll("[data-session-id]")].forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedSessionId = card.dataset.sessionId;
      const session = getSelectedSession();
      if (session) {
        elements.modeSelect.value = session.mode;
      }
      render();
    });
  });
}

function renderChat() {
  const session = getSelectedSession();

  if (!session) {
    elements.chatThread.className = "chat-thread empty-state";
    elements.chatThread.textContent = "Choose a session or begin with a new message.";
    return;
  }

  elements.chatThread.className = "chat-thread";
  elements.chatThread.innerHTML = session.messages
    .map(
      (message) => `
        <div class="message message-${message.role}">
          ${escapeHtml(message.content)}
        </div>
      `
    )
    .join("");
}

function renderReport() {
  const session = getSelectedSession();
  elements.reportSessionLabel.textContent = session ? session.title : "Current session";

  if (!session?.report) {
    elements.reportView.className = "report-view empty-state";
    elements.reportView.textContent = "Your report will appear here after the first message.";
    return;
  }

  const report = session.report;
  elements.reportView.className = "report-view";
  elements.reportView.innerHTML = `
    <section class="report-block">
      <h3>Summary</h3>
      <p>${escapeHtml(report.summary)}</p>
    </section>
    <section class="report-block">
      <h3>Themes</h3>
      <div class="theme-grid">
        ${report.themes.map((theme) => `<span class="pill">${escapeHtml(theme)}</span>`).join("")}
      </div>
    </section>
    <section class="report-block">
      <h3>Patterns</h3>
      ${
        report.patterns.length
          ? `<ul class="pattern-list">${report.patterns
              .map((pattern) => `<li>${escapeHtml(pattern)}</li>`)
              .join("")}</ul>`
          : `<p class="meta">No major pattern detected yet.</p>`
      }
    </section>
    <section class="report-block">
      <h3>Philosophical lens</h3>
      <p>${escapeHtml(report.philosophy)}</p>
    </section>
    <section class="report-block">
      <h3>Next questions</h3>
      <ul class="question-list">
        ${report.nextQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderNotes() {
  if (!state.data.notes.length) {
    elements.noteList.className = "note-list empty-state";
    elements.noteList.textContent = "No notes yet.";
    return;
  }

  elements.noteList.className = "note-list";
  elements.noteList.innerHTML = state.data.notes
    .map(
      (note) => `
        <article class="note-card">
          <h3>${escapeHtml(note.title)}</h3>
          <p>${escapeHtml(note.content)}</p>
          <span class="meta">${formatDate(note.updatedAt || note.createdAt)}</span>
        </article>
      `
    )
    .join("");
}

function renderActions() {
  if (!state.data.actions.length) {
    elements.actionList.className = "action-list empty-state";
    elements.actionList.textContent = "Suggested actions will show up here.";
    return;
  }

  elements.actionList.className = "action-list";
  elements.actionList.innerHTML = state.data.actions
    .map(
      (action) => `
        <article class="action-card">
          <h3>${escapeHtml(action.title)}</h3>
          <p>${escapeHtml(action.why)}</p>
          <footer>
            <span class="meta">${formatDate(action.updatedAt || action.createdAt)}</span>
            <select class="status-select" data-action-id="${action.id}">
              ${["todo", "doing", "done"]
                .map(
                  (status) => `
                    <option value="${status}" ${action.status === status ? "selected" : ""}>
                      ${status}
                    </option>
                  `
                )
                .join("")}
            </select>
          </footer>
        </article>
      `
    )
    .join("");

  [...elements.actionList.querySelectorAll("[data-action-id]")].forEach((select) => {
    select.addEventListener("change", () => updateActionStatus(select.dataset.actionId, select.value));
  });
}

function getSelectedSession() {
  return state.data.sessions.find((session) => session.id === state.selectedSessionId) || null;
}

function setChatPending(isPending) {
  const button = elements.chatForm.querySelector("button");
  button.disabled = isPending;
  button.textContent = isPending ? "Thinking..." : "Generate report";
}

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
