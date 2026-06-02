# Qwake Product Plan

Qwake is a local-first AI quota window waker. Its core job is to send tiny scheduled wake calls to local AI coding CLIs so users do not need to be awake, present, or inside an agent session when a quota window should be started or checked.

Qwake does not bypass limits, upload code, manage credentials, or require official Claude/Codex accounts. It calls the local command that already works on the user's machine, including third-party provider routes configured inside Claude Code, Codex, or custom CLIs.

## Product Priorities

1. **System-level scheduling**: the primary product surface is `qwake schedule install`, not a skill or chat command.
2. **One-shot wake**: `qwake wake` remains the primitive that schedules call.
3. **Smart window guard**: scheduled wakes should avoid redundant provider calls inside a known quota window. The default guard is `5h + 5m`.
4. **Observability**: users need `schedule status` and `schedule logs` to know whether wake attempts ran, succeeded, failed, or were skipped by smart mode.
5. **Optional task continuation**: task queue and resume commands remain experimental; they are not the MVP path.
6. **Skills/MCP later**: skills and MCP are useful configuration surfaces, but they should install/manage schedules rather than be required for wake execution.

## MVP Commands

Primary:

- `qwake init`
- `qwake doctor`
- `qwake wake <codex|claude|mock|custom>`
- `qwake wake <codex|claude|mock|custom> --smart --window-minutes 300 --buffer-minutes 5`
- `qwake probe <codex|claude|mock|custom>`
- `qwake schedule install <agent> --times 06:05,11:10,16:15,21:20`
- `qwake schedule status [agent]`
- `qwake schedule logs [agent]`
- `qwake schedule uninstall <agent>`

Experimental:

- `qwake add`
- `qwake run <codex|claude|mock|custom>`
- `qwake status`
- `qwake resume <task-id|next>`
- `qwake due --run`

## Scheduling Strategy

Qwake itself does not stay resident. It delegates timing to the operating system.

- macOS MVP: LaunchAgent plist under `~/Library/LaunchAgents`.
- Linux future: systemd timer first, cron fallback.
- Windows current manual path: npm creates command shims such as `qwake.cmd`; users can run that through a `.bat` wrapper and Task Scheduler.
- Windows future: `qwake schedule install` support for Task Scheduler.

The product promise is not "guaranteed quota refresh." The promise is:

> At configured wall-clock times, Qwake will attempt a tiny wake request and record the result.

Scheduled wakes use smart mode by default. Qwake stores the last successful wake for each agent in `~/.qwake/wakes/<agent>.json`. If a later scheduled run happens before `lastSuccessAt + windowMinutes + bufferMinutes`, Qwake writes `status=skipped` with `lastSuccessAt` and `nextWakeAt` instead of calling the provider.

If the machine is off, asleep, offline, or the provider rejects the request, Qwake records or exposes the failure where the platform permits.

## Acceptance

- `qwake wake mock` works without any provider login.
- `qwake schedule install mock --times <near-future-time>` installs a macOS LaunchAgent.
- `qwake schedule status mock` shows installed times and plist path.
- `qwake schedule logs mock` shows launch output after a scheduled run.
- A second smart wake inside the configured window logs `status=skipped` and does not call the provider.
- `qwake schedule uninstall mock` removes the LaunchAgent.
- Real `claude` and `codex` wakes depend on local CLIs and provider availability.
