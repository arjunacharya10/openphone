# Contributing to OpenPhone

Thanks for your interest in contributing. Here’s how to get started.

## Development Setup

1. Clone the repo and follow the [README](README.md) to install prerequisites.
2. Run `mulch prime` at the start of each session to load project expertise.

## Workflow

1. **Branch** — Create a branch from `main`: `git checkout -b your-feature`
2. **Commit** — Follow the [commit format](#commit-format) below.
3. **Pull Request** — Open a PR against `main`. Describe the change and any follow-ups.
4. **Mulch** — Before merging, run `mulch learn` and record useful insights with `mulch record`; then `mulch sync`.

## Commit Format

Use [Conventional Commits](https://www.conventionalcommits.org/) for clear, consistent history:

```
<type>(<scope>): <description>

[optional body]
```

**Types**

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `style` | Formatting, whitespace, etc. (no code change) |
| `chore` | Build, config, tooling, dependencies |

**Examples**

```
feat(ledger): show action taken in card detail view
fix(ws): handle reconnection when cards sync
docs: add CONTRIBUTING and env vars to README
refactor(qml): extract formatActionLabel helper
chore(deps): bump drizzle-orm to 0.45
```

Keep the first line under ~72 characters; add a body for more context.

## Code Style

- **TypeScript/JavaScript** — Follow existing patterns in the codebase.
- **QML** — Match conventions in `apps/openphone-ui/qml/`.
- Keep changes focused; split large features into smaller PRs.

## Testing

- Run `npm run dev` in `apps/openphone-core` and verify the app in `apps/openphone-ui`.
- For backend changes, manually test the relevant routes and WebSocket flows.

## Questions?

Open an issue or reach out to the maintainers.
