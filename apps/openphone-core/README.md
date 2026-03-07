# openphone-core

Fastify service that runs the AI agent loop, manages cards and the activity ledger, and exposes all API/WebSocket endpoints. Everything runs locally on-device — no cloud orchestration layer.

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SOURCES                            │
│  Gmail (Pub/Sub push)  ·  Calendar polling  ·  (future: Outlook...) │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ POST /inbound/gmail (etc.)
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        INGEST CHANNELS                              │
│  Debounce + per-account serialisation + global semaphore            │
│  Formats raw event into a natural-language description              │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ runInboundTurn(description, sessionKey)
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          AGENT LOOP                                 │
│                                                                     │
│  1. shouldRunMemoryFlush? → if yes, run flush sub-turn first        │
│                                                                     │
│  2. buildSystemPrompt()  [all loaded in parallel]                   │
│     ├── SOUL.md          persona, values, behavioural instincts     │
│     ├── AGENTS.md        operational rules, tool usage guidelines   │
│     ├── user.md          learned user preferences and contacts      │
│     ├── Known Facts      structured key-value pairs from facts DB   │
│     ├── Knowledge Graph  entity/relationship facts from Graphiti    │
│     ├── MEMORY.md        long-term narrative memory                 │
│     └── daily logs       today + yesterday activity logs            │
│                                                                     │
│  3. completeSimple / streamSimple (@mariozechner/pi-ai)             │
│     Model: configured in openphone.agent (OpenRouter / Ollama)      │
│                                                                     │
│  4. Tool dispatch loop (up to 10 iterations)                        │
│     ├── create_card          surface decision to user               │
│     ├── dismiss_card         close current card                     │
│     ├── skip_card            cycle to next card                     │
│     ├── log_action           write to activity ledger               │
│     ├── kg_search            query Graphiti knowledge graph         │
│     ├── set_fact             store structured key-value fact        │
│     ├── get_facts            read all stored facts                  │
│     ├── delete_fact          remove a stale fact                    │
│     ├── update_memory        append to MEMORY.md                    │
│     ├── update_user_context  append to user.md                      │
│     ├── append_daily_log     append to memory/YYYY-MM-DD.md         │
│     └── memory_get           read a memory file on demand           │
│                                                                     │
└──────┬──────────────────┬───────────────────────────────────────────┘
       │                  │
       ▼                  ▼
 ┌──────────┐      ┌─────────────────────────────────────────────────┐
 │  Cards   │      │              MEMORY SYSTEM                      │
 │  Ledger  │      │                                                 │
 │ (SQLite/ │      │  ┌─────────────────────────────────────────┐   │
 │  Drizzle)│      │  │  graphiti-service  (Python / FastAPI)   │   │
 └────┬─────┘      │  │                                         │   │
      │            │  │  POST /episodes  ← session transcripts  │   │
      ▼            │  │  POST /search    → relevant KG facts    │   │
 ┌──────────┐      │  │                                         │   │
 │ Event Bus│      │  │  Graphiti (entity extraction via LLM)   │   │
 │ pub/sub  │      │  │  KuzuDriver  →  graph.kuzu  (embedded)  │   │
 └────┬─────┘      │  │  Ollama  (local LLM for extraction)     │   │
      │            │  └─────────────────────────────────────────┘   │
      ▼            │                                                 │
 ┌──────────────┐  │  ┌─────────────────────────────────────────┐   │
 │  WebSocket   │  │  │  brain.db  (SQLite, embedded)           │   │
 │  clients     │  │  │  · meta table  (flush cooldown)         │   │
 │  /ws/voice   │  │  │  · facts table (set_fact / get_facts)   │   │
 │  /ws/whatsapp│  │  └─────────────────────────────────────────┘   │
 └──────────────┘  │                                                 │
                   │  ┌─────────────────────────────────────────┐   │
                   │  │  context/ files  (plain markdown)        │   │
                   │  │  · SOUL.md       persona (read-only)     │   │
                   │  │  · AGENTS.md     rules   (read-only)     │   │
                   │  │  · user.md       agent-written           │   │
                   │  │  · MEMORY.md     agent-written           │   │
                   │  │  · memory/*.md   agent-written           │   │
                   │  └─────────────────────────────────────────┘   │
                   └─────────────────────────────────────────────────┘
```

### Conversation Channels

User-initiated conversations follow the same agent loop but come in through WebSocket channels:

```
User device
  │  WebSocket /ws/voice  (STT done client-side, text sent as {type:'voice:message'})
  │  WebSocket /ws/whatsapp
  ▼
Conversation Channel
  │  withSessionLock(sessionKey, ...)
  │  runAgentTurnStream(params, onDelta)
  ▼
Agent Loop  (same loop as above, streaming)
  │  onDelta → WS chat:delta events
  └─ result → WS chat:response event
```

---

## Key Subsystems

### Persona & Rules (`context/`)

The AI's identity and behaviour is defined entirely in plain markdown files — no code changes needed.

| File | Purpose | Who writes it |
|---|---|---|
| `SOUL.md` | Core personality — values, tone, instincts, hard limits | You (human) |
| `AGENTS.md` | Operational rules — when to use each tool, prioritisation logic, edge case handling | You (human) |
| `openphone.agent` | Runtime config: model name, offline fallback | You (human) |
| `user.md` | Learned user preferences, contacts, communication patterns | Agent (via `update_user_context`) |
| `MEMORY.md` | Long-term narrative memory — facts, decisions, lessons | Agent (via `update_memory`) |
| `memory/YYYY-MM-DD.md` | Daily raw activity log | Agent (via `append_daily_log`) |

`SOUL.md` and `AGENTS.md` are injected first into every system prompt. They are the foundation everything else builds on.

### Agent Loop (`src/agent/`)

- `loop.ts` — `runAgentTurn` (non-streaming) and `runAgentTurnStream` (streaming with `onDelta`). Both check for a memory flush before each turn. Iterates up to 10 tool-call rounds per turn.
- `context.ts` — `buildSystemPrompt` loads all context sources in parallel (context files, facts, KG search). Also contains file append helpers (`appendMemory`, `appendDailyLog`, etc.) called by tool dispatch.
- `tools.ts` — tool schema definitions (what the model sees) and dispatch (what actually runs).
- `sessions.ts` — SQLite-backed session history with per-key serialisation lock.

### Memory System

Three complementary layers — each with a different retrieval profile:

**Knowledge Graph** (`apps/graphiti-service/` + `src/graph/`)

The primary long-term brain. A Python/FastAPI sidecar running Graphiti with a Kuzu embedded graph database (`graph.kuzu`). No separate database server — Kuzu is file-based.

- Ingestion: after each session flush, the full conversation transcript is sent as an episode. Graphiti uses Ollama (local LLM) to extract entities and relationships automatically, with deduplication and bi-temporal edge tracking (`valid_at` / `invalid_at`).
- Retrieval: `searchGraph(userMessage)` runs before every system prompt build, injecting relevant current facts into context.
- Tool: `kg_search` lets the agent query the graph mid-conversation.
- Degrades silently if the service is unreachable.

**Facts Store** (`brain.db` — `src/memory/`)

Structured key-value pairs the agent sets explicitly. Faster and more precise than graph search for scalar preferences.

- `set_fact("user.airline_preference", "Delta")` — upserts a fact
- `get_facts()` — all facts injected into every system prompt under `## Known Facts`
- `delete_fact(key)` — removes stale facts
- Backed by a `facts` table in `brain.db` (SQLite).

**Memory Flush** (`src/memory/flush.ts`)

Triggered automatically when session history exceeds 50KB (1hr cooldown per session). Runs a dedicated agent sub-turn with a focused system prompt instructing the agent to:
1. Extract structured facts → `set_fact`
2. Write narrative memory → `update_memory`
3. Write daily log → `append_daily_log`
4. Ingest session transcript into Graphiti → `addEpisode`

### Channels (`src/channels/`)

- **IngestChannel** — external data sources the AI monitors. Mounts HTTP routes (e.g. `POST /inbound/gmail`). Uses a 500ms debouncer + per-account serialisation + global concurrency semaphore before calling the agent.
- **ConversationChannel** — bidirectional user↔AI over WebSocket. Voice always on; WhatsApp gated by `WHATSAPP_ENABLED=true`.
- Both types registered via `registry.ts`, which calls `startAll()` / `stopAll()` on lifecycle events.

### Event Bus (`src/lib/event-bus.ts`)

Typed pub/sub for internal state events (`card:created`, `card:removed`, `ledger:entry`, etc.). Store mutations publish; WebSocket route handlers subscribe and push to connected clients.

---

## Routes

| Route | Description |
|---|---|
| `GET /api/health` | Liveness |
| `GET /api/status` | Runtime status |
| `GET /api/config` | Agent config |
| `GET /api/tools` | Tool list |
| `GET /api/cron` | Cron job list |
| `GET /api/integrations` | Integration registry |
| `GET /api/memory/status` | Facts count + Graphiti availability |
| `GET /api/memory/search?q=` | KG search proxy → Graphiti |
| `GET /api/memory/facts` | All structured facts |
| `POST /api/memory/facts` | Set a fact `{key, value}` |
| `DELETE /api/memory/facts/:key` | Delete a fact |
| `GET /cards` | Active card list |
| `GET /cards/:id` | Card detail |
| `GET /chat/session/:key/history` | Session chat history |
| `POST /inbound/gmail` | Gmail Pub/Sub push |
| `WS /ws/voice` | Voice conversation |
| `WS /ws/whatsapp` | WhatsApp conversation |

---

## Running the Graphiti Service

```bash
cd apps/graphiti-service
cp .env.example .env    # set KUZU_DB path and Ollama model
pip install -e .
python main.py          # starts on port 7473
```

openphone-core logs `graphiti-service: connected` on startup when reachable, and degrades gracefully (no KG injection) when not.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `GRAPHITI_SERVICE_URL` | `http://localhost:7473` | Graphiti sidecar URL |
| `WHATSAPP_ENABLED` | `false` | Enable WhatsApp channel |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama endpoint (for `ollama/` model prefix) |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter endpoint (for `openrouter/` prefix) |
