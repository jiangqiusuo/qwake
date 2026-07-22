# Qwake

[![npm version](https://img.shields.io/npm/v/@sysiphus/qwake.svg)](https://www.npmjs.com/package/@sysiphus/qwake)
[![License](https://img.shields.io/npm/l/@sysiphus/qwake.svg)](LICENSE)
[English](README.md) | [简体中文](README.zh-CN.md)

Local-first CLI for two small, practical jobs:

- Schedule and observe wake calls for Claude Code, Codex, and custom AI CLIs.
- Collect behavioral fingerprints from OpenAI-compatible endpoints and compare them with a trusted local reference.

Qwake does not bypass provider limits, manage accounts, upload source code, or prove a model's identity.

## Install

```bash
npm install -g @sysiphus/qwake
qwake doctor --fix
```

Requires Node.js 20 or newer.

## Schedule wake calls

Install a daily schedule, then verify the real system path:

```bash
qwake schedule install codex claude --times 06:05,11:10,16:15,21:20
qwake schedule doctor
qwake schedule test codex claude
qwake schedule logs
```

Qwake uses smart skipping by default, a 120-second command timeout, and per-agent locking to avoid duplicate wake calls. It supports macOS LaunchAgent, Windows Task Scheduler, and Linux systemd or crontab fallback.

## Audit a relay endpoint

Create a reference from an endpoint you trust, then audit another OpenAI-compatible endpoint:

```bash
export OFFICIAL_API_KEY='replace-with-your-key'
export RELAY_API_KEY='replace-with-your-key'

qwake fingerprint collect \
  --base-url https://api.example.com/v1 \
  --api-key-env OFFICIAL_API_KEY --model gpt-4o

qwake fingerprint enroll \
  --name gpt-4o-reference \
  --from ~/.qwake/fingerprints/runs/<run>.json

qwake fingerprint audit \
  --claim gpt-4o-reference \
  --base-url https://relay.example.com/v1 \
  --api-key-env RELAY_API_KEY --model gpt-4o
```

Fingerprint results are statistical evidence only. A difference may come from model updates, routing, quantization, caching, or hidden reasoning. API keys are read from environment variables and are not saved by Qwake.

## Learn more

- [Blog and setup guides](https://qwake.top/blog/)
- [Model fingerprinting design](design/model-fingerprinting-design.md)
- [All CLI commands](https://qwake.top/)
- [Contributing](CONTRIBUTING.md)

```bash
qwake --help
qwake fingerprint --help
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

Apache-2.0 licensed.
