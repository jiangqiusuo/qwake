# Qwake

[English](README.md) | [简体中文](README.zh-CN.md)

Qwake 是一个 local-first 的 AI 编码工具额度窗口唤醒器。

它会向本机 AI 编码 CLI 发送一次极小的 wake 请求，例如 Claude Code、Codex 或自定义 provider 命令。目标是让用户不用醒着、不用打开 agent、不用手动说一句话，也能在指定时间尝试启动或检查 provider 的额度窗口。

Qwake 不绕过额度限制，不管理账号凭证，不上传源码，也不要求你使用官方 Claude/Codex 账号。它只是调用你本机已经可用的命令。如果你的 `claude` CLI 已经路由到 GLM、OpenRouter、Bedrock、Vertex 或其他 provider，Qwake 会沿用这个配置。

## MVP 重点

MVP 聚焦于系统级定时唤醒：

```bash
qwake doctor
qwake wake claude
qwake schedule install claude --times 06:05,11:10,16:15,21:20
qwake schedule status claude
qwake schedule run claude
qwake schedule logs claude
```

任务队列命令仍然保留为实验功能，但不是当前 MVP 的主路径。

## 安装

用户安装：

```bash
npm install -g @sysiphus/qwake
qwake --help
```

本地开发：

```bash
pnpm install
pnpm build
pnpm dev -- --help
```

发布到 npm 前的本地全局测试：

```bash
npm install -g .
qwake --help
```

## 无需登录 Agent 的快速开始

使用内置 mock agent：

```bash
pnpm dev -- init
pnpm dev -- doctor
pnpm dev -- wake mock
pnpm dev -- probe mock
```

预期输出：

```text
[2026-06-01 09:20:00 +08:00] wake agent=mock status=success exitCode=0 limited=false durationMs=1 utc=2026-06-01T01:20:00.000Z
[2026-06-01 09:20:01 +08:00] probe agent=mock status=available exitCode=0 limited=false durationMs=1 utc=2026-06-01T01:20:01.000Z
```

## 真实使用配置

这是早期本地测试时已经跑通的流程：

```bash
pnpm build
npm install -g .
which qwake
qwake doctor
qwake schedule install claude --times 06:05,11:10,16:15,21:20
qwake schedule status claude
qwake schedule run claude
qwake schedule logs claude
```

如果已经从 npm 安装，则直接使用：

```bash
npm install -g @sysiphus/qwake
qwake doctor
qwake schedule install claude --times 06:05,11:10,16:15,21:20
```

## 唤醒 Claude Code

Qwake 会调用你本机安装的 `claude` 命令。它不关心 Claude Code 背后使用的是官方 Anthropic 账号、API Key，还是 Claude Code 内部配置的第三方 provider。

```bash
pnpm dev -- wake claude
```

如果你想使用 Claude Code 的可选预算保护：

```bash
pnpm dev -- wake claude --budget-usd 0.10
```

默认情况下，Qwake 不会设置 `--max-budget-usd`。这样可以兼容第三方 provider plan，因为它们的美元预算语义可能和实际额度系统并不一致。

## 唤醒 Codex

```bash
pnpm dev -- wake codex
```

默认 Codex wake 命令使用非交互的 `codex exec`，并启用只读 sandbox 和 no approval prompts。

## 自定义 Provider

编辑 `~/.qwake/config.yaml`：

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

然后运行：

```bash
pnpm dev -- wake custom
```

## Token 和额度行为

```text
doctor  = 零 token；只检查本地命令是否存在
wake    = 极小 live request；可能消耗少量 provider 额度
wake --smart = 只有本地 5 小时 + buffer 到期时，才发送极小 live request
probe   = 极小 live request；可能消耗少量 provider 额度
add     = 零 token；实验性的本地任务记录
run     = 真实任务执行；会消耗正常 AI 编码额度
resume  = 真实任务续跑；会消耗正常 AI 编码额度
```

当你明确想启动或验证 provider 额度窗口时，使用 `wake`。不要用 `run` 或 `resume` 做纯唤醒工作流。

## 定时唤醒

Qwake 自己不常驻后台。定时由操作系统负责。

在 macOS 上，Qwake 可以安装 LaunchAgent：

```bash
pnpm dev -- schedule install claude --times 06:05,11:10,16:15,21:20
pnpm dev -- schedule status claude
pnpm dev -- schedule run claude
pnpm dev -- schedule logs claude
pnpm dev -- schedule uninstall claude
```

安装命令会创建：

```text
~/Library/LaunchAgents/com.qwake.claude.plist
~/.qwake/logs/claude.log
~/.qwake/logs/claude.error.log
```

到了每个配置的墙钟时间，launchd 会运行一次极小的智能 `qwake wake claude --smart` 请求。默认情况下，定时唤醒只有在距离该 agent 上一次成功 wake 至少过去 `5 小时 + 5 分钟` 后，才会真的调用 provider。如果还在这个窗口内，Qwake 会写入 `status=skipped`，不会消耗一次 live provider 请求。

安装时可以调整这个保护窗口：

```bash
qwake schedule install claude --times 06:05,11:10,16:15,21:20 --window-minutes 300 --buffer-minutes 5
```

只有当你明确希望每个定时点都调用 provider 时，才关闭 smart skipping：

```bash
qwake schedule install claude --times 06:05,11:10,16:15,21:20 --no-smart
```

Qwake 能保证的是“尝试唤醒并记录结果”，不能保证 provider 一定刷新额度。如果电脑关机、完全深度睡眠、断网，或 provider 拒绝请求，唤醒可能失败。

如果你不想等到下一个定时点，可以手动触发一次已安装的 LaunchAgent 来验证链路：

```bash
qwake schedule run claude
sleep 20
qwake schedule logs claude
```

成功日志会类似这样：

```text
[2026-06-01 09:20:00 +08:00] wake agent=claude status=success exitCode=0 limited=false durationMs=1842 utc=2026-06-01T01:20:00.000Z
```

`status=success` 表示 wake 命令完成；`status=limited` 表示 Qwake 检测到了额度或 rate limit 响应；`status=failed` 表示本地命令失败或 provider 拒绝了请求。`status=skipped` 表示 smart mode 判断上一次成功 wake 仍在配置窗口内，所以主动跳过了 live provider 调用；日志里会带上 `lastSuccessAt` 和 `nextWakeAt`。

MacBook 合盖后仍然执行，并不代表 Qwake 自己在后台常驻。更常见的原因是 macOS 还没有进入完全深度睡眠、机器短暂唤醒、启用了 Power Nap/网络唤醒，或者接了外部电源。判断是否真的执行，以日志时间戳为准：它能证明 Qwake 在那个时间点尝试了 wake，但 provider 是否真正刷新额度仍由 provider 决定。

在 macOS/Linux 上，也可以用 cron 固定时间运行：

```cron
5 6 * * * qwake wake claude --smart
10 11 * * * qwake wake claude --smart
15 16 * * * qwake wake claude --smart
20 21 * * * qwake wake claude --smart
```

这些 cron 任务同样使用 smart guard：如果上一次成功 wake 还在 `5 小时 + 5 分钟` 窗口内，Qwake 会记录 `status=skipped`，不会真的调用 provider。如果你明确希望每次 cron 都调用 provider，可以去掉 `--smart`。

如果是本地开发环境、没有全局安装，也可以指向仓库命令：

```cron
5 6 * * * cd /Users/wangxb/Documents/codex项目 && pnpm dev -- wake claude --smart
```

这个 cron 表达式表示：

```text
minute: 5, 10, 15, 20
hour:   6, 11, 16, 21
day:    every day
month:  every month
weekday: every weekday
```

也就是每天 06:05、11:10、16:15、21:20 检查配置的 agent。

在 macOS 笔记本上，launchd 通常比 cron 更适合长期使用，因为它在机器从睡眠中唤醒后更可靠。Qwake 的 `schedule install` 使用的就是 launchd。

## 本地数据

默认情况下，Qwake 只写入：

```text
~/.qwake/
  config.yaml
  wakes/
  tasks/
```

`wake` 和 `probe` 命令不会写入你的项目目录。Smart wake 状态会保存在 `~/.qwake/wakes/<agent>.json`。

## 命令

MVP 主命令：

```bash
qwake init
qwake doctor
qwake wake mock
qwake wake claude
qwake wake codex
qwake wake custom
qwake probe claude
qwake schedule install claude --times 06:05,11:10,16:15,21:20
qwake schedule status claude
qwake schedule run claude
qwake schedule logs claude
qwake schedule uninstall claude
```

实验性的任务续跑命令：

```bash
qwake add --goal "Continue migration" --agent mock
qwake run mock --limit --goal "Demo limit handling"
qwake status
qwake resume next
qwake due --run
```

## 项目状态

这是一个早期开源 MVP。第一批真实 CLI 支持 Codex 和 Claude Code，同时提供 `mock` 和 `custom` 用于免登录测试和 provider 实验。

## 发布和开源流程

完整流程见 [docs/RELEASE.md](docs/RELEASE.md)：

- 本地正式使用
- npm 打包和发布
- GitHub 开源仓库设置
- 独立站落地页部署
- slogan 和产品定位建议
