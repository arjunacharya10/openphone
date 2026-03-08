# graphiti-service

Python/FastAPI sidecar that provides the knowledge graph brain for openphone-core. Wraps [Graphiti](https://github.com/getzep/graphiti) with a [Kuzu](https://kuzudb.com/) embedded graph database — no separate DB server required.

---

## What it does

- **Ingests conversations** as episodes → Graphiti uses a local Ollama LLM to extract entities and relationships automatically, with deduplication and bi-temporal edge tracking (`valid_at` / `invalid_at`)
- **Answers semantic queries** over the knowledge graph → returns currently-valid facts relevant to a question
- Called by openphone-core after each memory flush (episode ingestion) and before each agent turn (context injection)

---

## Setup

Requires [uv](https://docs.astral.sh/uv/) and [Ollama](https://ollama.com/) running locally.

```bash
# Pull the models you'll use (once)
ollama pull llama3.1:8b
ollama pull nomic-embed-text

# Configure
cp .env.example .env
# Edit .env if your paths or models differ

# Run
uv run python main.py
```

uv automatically creates a virtualenv with Python 3.13 and installs all dependencies on first run.

---

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `KUZU_DB` | `../openphone-core/context/memory/graph.kuzu` | Path to the Kuzu graph database directory |
| `LLM_BASE_URL` | `http://localhost:11434/v1` | Ollama OpenAI-compatible endpoint |
| `LLM_API_KEY` | `ollama` | API key (any non-empty string for Ollama) |
| `LLM_MODEL` | `llama3.1:8b` | Model used for entity extraction and reranking |
| `EMBEDDING_BASE_URL` | same as `LLM_BASE_URL` | Embedding endpoint |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Embedding model |
| `GROUP_ID` | `openphone` | Scopes all episodes to a single user namespace |
| `PORT` | `7473` | HTTP listen port |

---

## API

### `GET /health`
Liveness check. Returns `{"ok": true}`.

### `GET /status`
Reports db path, model, and probes Kuzu with a test query.

### `POST /episodes`
Ingest a conversation or event into the knowledge graph.

```json
{
  "name": "session:voice:2026-03-07",
  "content": "User: Can you book a Delta flight to NYC?\nAssistant: Done, logged.",
  "source_description": "openphone conversation"
}
```

Graphiti extracts entities (`Delta`, `NYC`, user preferences) and stores them as nodes and bi-temporal edges.

### `POST /search`
Search for currently-valid facts relevant to a query.

```json
{ "query": "user travel preferences", "num_results": 10 }
```

Returns only facts where `invalid_at` is null (i.e. not superseded).

---

## Data

The graph database is stored at the `KUZU_DB` path as a directory (`graph.kuzu/`). It is auto-created on first run and excluded from git. Back it up like any other stateful file.
