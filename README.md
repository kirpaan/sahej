# Conscious Second Brain

A barebones local-first prototype for the idea you described: capture project chats and reflections, generate reports, and turn them into next actions without sending data to a cloud service.

## What this MVP includes

- local dashboard with sessions, notes, reports, and actions
- chat modes for `reflection`, `project`, and `conversation`
- automatic report generation after each message
- local JSON persistence in `data/app-data.json`
- optional Ollama integration if you install and run it later
- graceful fallback analysis when Ollama is not available

## Run it

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

## Optional Ollama upgrade

If you install Ollama later, the server will automatically try to use it through:

- `OLLAMA_URL` default: `http://127.0.0.1:11434/api/chat`
- `OLLAMA_MODEL` default: `qwen2.5:7b`

Example:

```bash
$env:OLLAMA_MODEL="llama3.1:8b"
npm start
```

## Suggested next steps

1. Replace JSON file storage with SQLite.
2. Add per-project workspaces and session tagging.
3. Add embeddings and retrieval memory for long-term pattern detection.
4. Add proper local auth/encryption if this becomes a personal production tool.
