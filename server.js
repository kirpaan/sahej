const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const dotenv = require("dotenv");

dotenv.config();

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_PATH = path.join(DATA_DIR, "app-data.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

ensureDataFile();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/state") {
      return sendJson(res, 200, loadState());
    }

    if (req.method === "POST" && url.pathname === "/api/reflect") {
      const body = await readJsonBody(req);
      const result = await handleReflect(body);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/notes") {
      const body = await readJsonBody(req);
      const result = handleNoteSave(body);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/actions/update") {
      const body = await readJsonBody(req);
      const result = handleActionUpdate(body);
      return sendJson(res, 200, result);
    }

    if (req.method === "GET") {
      return serveStatic(url.pathname, res);
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, {
      error: error.message || "Unexpected server error",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Sahej backend running on http://0.0.0.0:${PORT}`);
});

async function handleReflect(body) {
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError(
      500,
      "GEMINI_API_KEY is missing. Create a .env file next to server.js and add your Gemini key."
    );
  }

  const state = loadState();
  const mode = normalizeMode(body.mode);
  const message = String(body.message || "").trim();
  const sessionId = body.sessionId ? String(body.sessionId) : null;

  if (!message) {
    throw new AppError(400, "Message is required.");
  }

  let session = state.sessions.find((entry) => entry.id === sessionId);
  if (!session) {
    session = {
      id: createId("session"),
      title: makeSessionTitle(mode, message),
      mode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      report: null,
      linkedActionIds: [],
    };
    state.sessions.unshift(session);
  }

  session.messages.push({
    id: createId("message"),
    role: "user",
    content: message,
    createdAt: new Date().toISOString(),
  });
  session.updatedAt = new Date().toISOString();

  const report = await generateGeminiReport({
    mode,
    message,
    recentContext: session.messages.slice(-6).map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
  });

  session.messages.push({
    id: createId("message"),
    role: "assistant",
    content: report.summary,
    createdAt: new Date().toISOString(),
  });

  session.report = report;
  persistState(state);

  return {
    ok: true,
    report,
    sessionId: session.id,
  };
}

function handleNoteSave(body) {
  const state = loadState();
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  const noteId = body.noteId ? String(body.noteId) : null;

  if (!content) {
    throw new AppError(400, "Note content is required.");
  }

  let note = state.notes.find((entry) => entry.id === noteId);
  if (!note) {
    note = {
      id: createId("note"),
      createdAt: new Date().toISOString(),
    };
    state.notes.unshift(note);
  }

  note.title = title || makeNoteTitle(content);
  note.content = content;
  note.updatedAt = new Date().toISOString();

  persistState(state);
  return { ok: true, state, note };
}

function handleActionUpdate(body) {
  const state = loadState();
  const actionId = String(body.id || "");
  const status = String(body.status || "");

  if (!new Set(["todo", "doing", "done"]).has(status)) {
    throw new AppError(400, "Invalid action status.");
  }

  const action = state.actions.find((entry) => entry.id === actionId);
  if (!action) {
    throw new AppError(404, "Action not found.");
  }

  action.status = status;
  action.updatedAt = new Date().toISOString();
  persistState(state);

  return { ok: true, state, action };
}

async function generateGeminiReport({ mode, message, recentContext }) {
  const prompt = buildGeminiPrompt({ mode, message, recentContext });
  const schema = buildGeminiSchema();

  let response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
        },
      }),
    });
  } catch (error) {
    throw new AppError(502, `Gemini request failed: ${error.message}`);
  }

  const payload = await safeReadJson(response);
  if (!response.ok) {
    const messageText =
      payload?.error?.message || `Gemini request failed with status ${response.status}.`;
    throw new AppError(502, messageText);
  }

  const text =
    payload?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text ||
    "";
  if (!text) {
    throw new AppError(502, "Gemini returned an empty response.");
  }

  const parsed = extractJsonObject(text);
  if (!parsed) {
    throw new AppError(502, "Gemini returned invalid JSON.");
  }

  return validateGeminiReport(parsed);
}

function buildGeminiPrompt({ mode, message, recentContext }) {
  return [
    "You are Sahej, a conscious companion that helps users notice autopilot loops and act with intention.",
    "Analyze the thought below and return JSON only.",
    "The output must match the provided schema exactly.",
    "Interpret patterns carefully and avoid dogmatic claims.",
    "Rules:",
    "- Identify recurring motives or internal conflicts.",
    "- Every pattern must be classified as either Autopilot or Authentic.",
    "- Philosophy must be one concise lens, not a long essay.",
    "- Actions must be practical next steps the user can take soon.",
    `Mode: ${mode}`,
    `Recent context: ${JSON.stringify(recentContext)}`,
    `Latest thought: ${message}`,
  ].join("\n");
}

function buildGeminiSchema() {
  return {
    type: "object",
    properties: {
      summary: { type: "string" },
      themes: {
        type: "array",
        items: { type: "string" },
      },
      patterns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            type: { type: "string", enum: ["Autopilot", "Authentic"] },
            evidence: { type: "string" },
          },
          required: ["label", "type", "evidence"],
        },
      },
      philosophy: { type: "string" },
      actions: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["summary", "themes", "patterns", "philosophy", "actions"],
  };
}

function validateGeminiReport(raw) {
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const themes = Array.isArray(raw.themes)
    ? raw.themes.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const patterns = Array.isArray(raw.patterns)
    ? raw.patterns
        .map((item) => ({
          label: typeof item?.label === "string" ? item.label.trim() : "",
          type: typeof item?.type === "string" ? item.type.trim() : "",
          evidence: typeof item?.evidence === "string" ? item.evidence.trim() : "",
        }))
        .filter(
          (item) =>
            item.label &&
            item.evidence &&
            (item.type === "Autopilot" || item.type === "Authentic")
        )
    : [];
  const philosophy = typeof raw.philosophy === "string" ? raw.philosophy.trim() : "";
  const actions = Array.isArray(raw.actions)
    ? raw.actions.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!summary || !themes.length || !philosophy || !actions.length) {
    throw new AppError(502, "Gemini returned incomplete structured data.");
  }

  return {
    summary,
    themes: themes.slice(0, 6),
    patterns: patterns.slice(0, 6),
    philosophy,
    actions: actions.slice(0, 5),
  };
}

function normalizeMode(mode) {
  return ["project", "reflection", "conversation"].includes(mode) ? mode : "reflection";
}

function makeSessionTitle(mode, message) {
  const prefixes = {
    project: "Project",
    reflection: "Reflection",
    conversation: "Conversation",
  };

  return `${prefixes[mode]}: ${trimPreview(message, 48)}`;
}

function makeNoteTitle(content) {
  return `Note: ${trimPreview(content, 42)}`;
}

function trimPreview(text, maxLength) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_PATH)) {
    persistState({ sessions: [], notes: [], actions: [] });
  }
}

function loadState() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function persistState(state) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(state, null, 2));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new AppError(400, "Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function serveStatic(requestPath, res) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(PUBLIC_DIR, safePath);
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

  if (!fs.existsSync(normalized) || fs.statSync(normalized).isDirectory()) {
    return sendJson(res, 404, { error: "File not found" });
  }

  const ext = path.extname(normalized).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
  });
  fs.createReadStream(normalized).pipe(res);
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return null;
  }
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
