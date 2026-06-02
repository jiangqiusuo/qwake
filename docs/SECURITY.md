# Security and Privacy

Qwake is local-first.

- It stores data under `~/.qwake` by default.
- It does not upload source code.
- It does not manage Codex, Claude Code, or third-party provider credentials.
- It does not require users to paste API keys, tokens, or secrets into Qwake commands.
- It does not attempt to bypass quotas, limits, or usage policies.
- It does not install a background daemon. On macOS, `qwake schedule install` creates a user LaunchAgent plist that can be removed with `qwake schedule uninstall`.

`qwake doctor` only checks local command availability. `qwake wake`, `qwake probe`, and installed wake schedules send tiny prompts to the configured agent command and can consume a small amount of provider quota. `qwake wake --smart` and default scheduled wakes keep local state in `~/.qwake/wakes/` and skip redundant provider calls inside the configured window. Experimental commands such as `run`, `resume`, and `due --run` can consume normal coding-agent quota.

Qwake examples intentionally avoid embedding credentials in CLI arguments, batch files, plist files, cron entries, or Task Scheduler actions. If a custom provider requires secrets, configure them through that provider's normal secure mechanism rather than hard-coding them in schedules.

Resume files can include captured terminal output. Logs can include agent command output. Treat `~/.qwake` as developer-workstation data and avoid committing it to repositories.

If you find a security issue, please open a private disclosure channel once the project has a public repository configured.
