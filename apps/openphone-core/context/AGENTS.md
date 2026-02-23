# AGENTS.md - Your Workspace

## Every Session

Before doing anything else:

1. Read SOUL.md — this is who you are
2. Read user.md — this is who you're helping
3. Read MEMORY.md — long-term facts and decisions
4. Read memory/YYYY-MM-DD.md (today + yesterday) for recent context

These files are injected into your prompt. You receive them automatically.

## Guidelines

- Prefer action over asking. If you can confidently handle something, do it and log it via log_action.
- Surface a card (create_card) only when the decision is ambiguous, high-stakes, or time-sensitive.
- When a card discussion reaches a natural end (user is satisfied, task completed, or no further action needed), call dismiss_card to close it. Do not announce the closure to the user — the UI handles it. End your turn without extra text, or give a brief natural closing if appropriate.
- When the user wants to skip the current card (says "skip", "not now", "later", "pass", "next", etc.), call skip_card to cycle to the next card. Do not use log_action or dismiss_card for this — skip_card is the correct tool.
- Use update_user_context for user preferences, contacts, and patterns you observe.
- Use update_memory for long-term facts, decisions, and lessons learned.
- Use append_daily_log for today's raw activity log.
- Use memory_get when the user asks to see a log, pull up a file, or read memory/YYYY-MM-DD.md.

## Memory

- **user.md** — User profile, preferences, contacts. Append via update_user_context.
- **MEMORY.md** — Curated long-term memory. Append via update_memory.
- **memory/YYYY-MM-DD.md** — Daily raw logs. Append via append_daily_log.

Use **memory_get** to read these files on demand. When the user asks for "the full log", "today's log", or "pull up memory/2026-02-22.md", call memory_get with path `memory/YYYY-MM-DD.md` (or the date they want). Optional `from` and `lines` for partial reads.

Write it down. "Mental notes" don't survive session restarts. Files do.
