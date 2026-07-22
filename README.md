# Qwake

[![npm version](https://img.shields.io/npm/v/@sysiphus/qwake.svg)](https://www.npmjs.com/package/@sysiphus/qwake)
[![npm downloads](https://img.shields.io/npm/dm/@sysiphus/qwake.svg)](https://www.npmjs.com/package/@sysiphus/qwake)
[![GitHub release](https://img.shields.io/github/v/release/jiangqiusuo/qwake)](https://github.com/jiangqiusuo/qwake/releases)
[![License](https://img.shields.io/npm/l/@sysiphus/qwake.svg)](LICENSE)
[English](README.md) | [简体中文](README.zh-CN.md)

Local-first quota window waker for AI coding agents such as Claude Code, Codex, and custom CLI providers.

Qwake sends a tiny wake request through the agent command that already works on your machine. It does not bypass provider limits, manage credentials, upload source code, or require a specific official account.

Qwake also includes an experimental model fingerprinting workflow for auditing OpenAI-compatible relay or aggregator endpoints. It samples short answers to simple prompts, builds local behavioral fingerprints, and compares endpoint behavior against a trusted reference profile.

## Install

```bash
npm install -g @sysiphus/qwake
qwake --help
```

Requires Node.js 20 or newer.

## Quick Start

Three commands are enough for the common Claude Code + Codex workflow:

```bash
qwake doctor --fix
qwake schedule install codex claude --times 06:05,11:10,16:15,21:20
qwake schedule doctor
```

Test the installed schedules once:

```bash
qwake schedule test codex claude
qwake schedule logs
```

Audit an OpenAI-compatible relay endpoint:

```bash
export RELAY_API_KEY=sk-...
qwake fingerprint collect --base-url https://relay.example.com/v1 --api-key-env RELAY_API_KEY --model gpt-4o --samples 15
qwake fingerprint enroll --name gpt-4o-reference --from ~/.qwake/fingerprints/runs/<run>.json
qwake fingerprint audit --claim gpt-4o-reference --base-url https://relay.example.com/v1 --api-key-env RELAY_API_KEY --model gpt-4o --samples 15
```

Test without any agent login by using the built-in mock agent:

```bash
qwake wake mock
qwake probe mock
```

## Common Commands

```bash
qwake init
qwake doctor
qwake doctor --fix
qwake wake claude
qwake wake codex --timeout-seconds 120
qwake wake custom
qwake probe claude
qwake schedule install codex claude --times 06:05,11:10,16:15,21:20
qwake schedule status codex
qwake fingerprint collect --base-url https://relay.example.com/v1 --api-key-env RELAY_API_KEY --model gpt-4o
qwake fingerprint enroll --name gpt-4o-reference --from ~/.qwake/fingerprints/runs/<run>.json
qwake fingerprint audit --claim gpt-4o-reference --base-url https://relay.example.com/v1 --api-key-env RELAY_API_KEY --model gpt-4o
qwake schedule doctor
qwake schedule test codex claude
qwake schedule run codex claude
qwake schedule repair codex claude
qwake schedule repair --all
qwake schedule logs
qwake schedule uninstall codex claude
qwake fingerprint collect --base-url https://relay.example.com/v1 --api-key-env RELAY_API_KEY --model gpt-4o
qwake fingerprint enroll --name gpt-4o-reference --from ~/.qwake/fingerprints/runs/<run>.json
qwake fingerprint audit --claim gpt-4o-reference --base-url https://relay.example.com/v1 --api-key-env RELAY_API_KEY --model gpt-4o
```

## Scheduling

Qwake does not stay resident. Scheduling is handled by the operating system.

On macOS, `schedule install` creates a LaunchAgent. On Windows, it creates daily `schtasks` entries. On Linux, it prefers `systemd --user` service and timer units, then falls back to `crontab` when systemd is unavailable:

```bash
qwake schedule install codex claude --times 06:05,11:10,16:15,21:20
```

The schedule runs a smart wake by default. It only calls the provider when at least `5h + 5m` has passed since the last successful wake for that agent. Otherwise Qwake logs `status=skipped` and avoids spending a live request.

Qwake also keeps one wake lock per agent. If a wake for the same agent is already running, a duplicate wake is skipped instead of starting another provider call.

Tune the smart window:

```bash
qwake schedule install codex claude --times 06:05,11:10,16:15,21:20 --window-minutes 300 --buffer-minutes 5
```

Disable smart skipping only when every scheduled time should call the provider:

```bash
qwake schedule install codex claude --times 06:05,11:10,16:15,21:20 --no-smart
```

Scheduled wake calls include a 120-second hard timeout by default:

```bash
qwake schedule install codex claude --times 06:05,11:10,16:15,21:20 --timeout-seconds 120
```

On Windows, you can inspect or remove the generated tasks with:

```bat
schtasks /Query /TN "\Qwake\codex-0605"
schtasks /Delete /TN "\Qwake\codex-0605" /F
```

On Linux with systemd, you can inspect the generated timer with:

```bash
systemctl --user status qwake-codex.timer
systemctl --user list-timers | grep qwake
```

If the machine does not provide `systemd --user`, Qwake falls back to `crontab` and installs the same daily times there.

## Agents

### Claude Code

Qwake wraps your installed `claude` command:

```bash
qwake wake claude
```

Optional Claude Code budget guard:

```bash
qwake wake claude --budget-usd 0.10
```

By default Qwake does not set `--max-budget-usd`, which keeps it compatible with third-party provider plans where USD budget semantics may not match the actual quota system.

### Codex

```bash
qwake wake codex
```

The default Codex wake command uses non-interactive `codex exec` with read-only sandboxing, ephemeral sessions, skipped project-git checks, and ignored user config. Wake calls have a 120-second hard timeout by default so a stuck CLI process cannot block later schedule windows.

Tune the timeout:

```bash
qwake wake codex --timeout-seconds 120
```

### Custom Providers

Edit `~/.qwake/config.yaml`:

```yaml
agents:
  custom:
    command: your-ai-cli
    args: ["--print"]
    limitPatterns:
      - usage limit
      - rate limit
      - quota
```

Then run:

```bash
qwake wake custom
```

## Logs

View schedule logs:

```bash
qwake schedule logs codex
```

Log status meanings:

```text
success = the wake command completed
limited = Qwake detected a quota or rate-limit response
failed  = the local command failed, timed out, or was rejected
skipped = smart mode avoided a live call because the previous success is still inside the configured window
```

Timed out commands use exit code `124` and include `timedOut=true`. The default wake timeout is 120 seconds and can be overridden with `--timeout-seconds`.
If another wake for the same agent is already running, Qwake logs `status=skipped`.

## Model Fingerprinting

`qwake fingerprint` is an experimental endpoint integrity check inspired by single-token behavioral fingerprinting research. It is designed for OpenAI-compatible APIs, including many relay and aggregator services.

The workflow is:

```bash
qwake fingerprint collect --base-url https://api.openai.com/v1 --api-key-env OPENAI_API_KEY --model gpt-4o
qwake fingerprint enroll --name gpt-4o-official --from ~/.qwake/fingerprints/runs/<run>.json
qwake fingerprint audit --claim gpt-4o-official --base-url https://relay.example.com/v1 --api-key-env RELAY_API_KEY --model gpt-4o
```

The default `mini` preset asks eight simple probe cells in English, 15 samples each. Use `--languages en,zh` to add Chinese prompts, or `--preset full` for the larger task set.

Qwake stores runs and profiles locally under:

```text
~/.qwake/fingerprints/
  runs/
  profiles/
```

API keys are read from environment variables and are not written to Qwake config, run files, or reports.

Fingerprint results are statistical evidence, not cryptographic proof. A `likely_mismatch` result means the endpoint's short-answer distribution is far from the saved reference profile; benign causes can include model updates, quantization, serving-provider changes, response caching, or hidden reasoning modes.

## Notes

`doctor` only checks local commands and does not spend provider quota. `wake`, `wake --smart`, and `probe` may send a tiny live request and can spend a small amount of provider quota.

Qwake can attempt the wake and record the result, but it cannot guarantee a provider quota refresh if the computer is off, fully asleep, offline, or the provider rejects the request.

On macOS laptops, launchd is usually more reliable than cron after sleep. For deep sleep or powered-off machines, configure a system wake event separately, for example with `pmset`.

On macOS/Linux, cron can also run Qwake:

```cron
5 6 * * * qwake wake claude --smart
10 11 * * * qwake wake claude --smart
15 16 * * * qwake wake claude --smart
20 21 * * * qwake wake claude --smart
```

The `--timeout-seconds` option is cross-platform for direct `wake` commands, including cron, systemd timers, and Windows Task Scheduler wrappers.

## Local Data

By default Qwake writes only to:

```text
~/.qwake/
  config.yaml
  wakes/
  logs/
```

Wake and probe commands do not write into your project directory. Smart wake state is stored under `~/.qwake/wakes/<agent>.json`.

## Development

```bash
pnpm install
pnpm build
pnpm test
npm run release:check
pnpm dev -- --help
```

For local global testing before npm publish:

```bash
npm install -g .
qwake --help
```

## Project Status

This is an early open-source project. The first supported real CLIs are Codex and Claude Code, with `mock` and `custom` for no-login testing and provider experiments.
