# OpenPhone

OpenPhone is an AI-first personal assistant device interface built on Ubuntu Core. This monorepo contains the UI shell, core orchestration service, assistant service, shared API contracts, snap packaging configurations, and development tooling.

## Prerequisites

- **Node.js** (v18+) — for openphone-core
- **Qt** (6.x) with Quick and WebSockets — for openphone-ui
- **Mulch** — for structured expertise (see below)

## Install Mulch

This project uses [Mulch](https://github.com/jayminwest/mulch) for expertise management. Install it once to participate in the team workflow:

```bash
npm install -g mulch-cli
```

Or run without installing:

```bash
npx mulch-cli <command>
```

The repo already has `.mulch/` set up. After installing Mulch:

1. **At the start of each session** — load project expertise:
   ```bash
   mulch prime
   ```
   Use `mulch prime --files src/foo.ts` to scope to specific files.

2. **Before finishing a task** — record learnings so your teammates benefit:
   ```bash
   mulch learn                    # See changed files and suggested domains
   mulch record <domain> --type <convention|pattern|failure|decision|reference|guide> --description "..."
   mulch sync                     # Validate and commit .mulch/ changes
   ```

Run `mulch status` for domain stats, `mulch --help` for full usage.

## Getting Started

### openphone-core (Node.js / Fastify)

```bash
cd apps/openphone-core
npm install
npm run dev
```

Starts the API + WebSocket server (default port 3000).

### openphone-ui (Qt / QML)

```bash
cd apps/openphone-ui
qmake
make
./openphone-ui.app/Contents/MacOS/openphone-ui   # macOS
# or
./openphone-ui                                  # Linux
```

### contracts (shared TypeScript types)

```bash
cd contracts
npm install
```

## Environment Variables

All env vars apply to **openphone-core**. Copy `apps/openphone-core/.env.example` to `apps/openphone-core/.env` and set values. Shell `export` also works.

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP + WebSocket server port | `3000` |
| `OLLAMA_BASE_URL` | Ollama API base URL (offline fallback) | `http://localhost:11434/v1` |
| `OPENROUTER_BASE_URL` | OpenRouter API base URL | `https://openrouter.ai/api/v1` |
| `OPENROUTER_API_KEY` | OpenRouter API key for cloud models | — |
| `GMAIL_INBOUND_TOKEN` | Optional auth token for Gmail webhook (`x-gog-token` or `?token=`) | — |
| `INBOUND_DEBOUNCE_MS` | Gmail inbound debounce (ms) | `500` |
| `INBOUND_MAX_CONCURRENT` | Max concurrent inbound agent turns | `5` |

## Project Layout

| Path | Description |
|------|-------------|
| `apps/openphone-core/` | Node.js Fastify service — API, WebSocket, state |
| `apps/openphone-ui/` | Qt/QML device UI shell |
| `contracts/` | Shared TypeScript events and types |
| `.mulch/` | Mulch expertise (git-tracked) |

## Team Workflow

1. Pull latest and run `mulch prime` when starting work.
2. Implement your changes as usual.
3. Before committing, run `mulch learn` and record any useful conventions, patterns, or decisions.
4. Run `mulch sync` to validate and commit `.mulch/` updates.
