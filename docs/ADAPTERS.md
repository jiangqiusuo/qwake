# Agent Adapters

Qwake adapters are small command wrappers used by `wake`, `probe`, and the experimental task commands. An adapter defines:

- the executable command
- default command arguments
- output patterns that indicate usage or quota limits
- resume behavior

The MVP ships with:

- `codex`
- `claude`
- `mock`
- `custom`

## Configuration

Adapters are configured in `~/.qwake/config.yaml`:

```yaml
agents:
  claude:
    command: claude
    args: []
    limitPatterns:
      - usage limit
      - rate limit
      - try again later
      - quota
```

## Custom Adapter

Use `custom` when testing another command:

```yaml
agents:
  custom:
    command: ./scripts/my-agent
    args: []
    limitPatterns:
      - usage limit
```

Then run:

```bash
qwake run custom --goal "Continue local test"
```
