# Contributing

Thanks for helping build Qwake.

## Development

```bash
pnpm install
pnpm test
pnpm build
```

Use the mock agent for tests and demos:

```bash
pnpm dev -- run mock --limit --goal "Demo queued task"
pnpm dev -- status
pnpm dev -- resume next
```

## Principles

- Keep Qwake local-first.
- Do not add quota bypass behavior.
- Do not require Codex or Claude Code login for automated tests.
- Keep adapters small and configuration-driven where possible.
