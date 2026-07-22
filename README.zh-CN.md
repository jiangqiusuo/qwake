# Qwake

[![npm version](https://img.shields.io/npm/v/@sysiphus/qwake.svg)](https://www.npmjs.com/package/@sysiphus/qwake)
[![License](https://img.shields.io/npm/l/@sysiphus/qwake.svg)](LICENSE)
[English](README.md) | [简体中文](README.zh-CN.md)

一个 local-first CLI，专注解决两件小而实际的事情：

- 为 Claude Code、Codex 与自定义 AI CLI 安排并观察 wake 请求。
- 从 OpenAI-compatible endpoint 采集行为指纹，并与本地可信基准进行对比。

Qwake 不绕过 provider 限制、不管理账号、不上传源码，也不证明模型身份。

## 安装

```bash
npm install -g @sysiphus/qwake
qwake doctor --fix
```

需要 Node.js 20 或更高版本。

## 定时唤醒

安装每日任务后，直接验证真实的系统调度链路：

```bash
qwake schedule install codex claude --times 06:05,11:10,16:15,21:20
qwake schedule doctor
qwake schedule test codex claude
qwake schedule logs
```

Qwake 默认启用 smart skipping、120 秒命令超时与每 agent 锁，避免重复 wake。支持 macOS LaunchAgent、Windows Task Scheduler，以及 Linux systemd 或 crontab fallback。

## 审计中转 endpoint

先从可信 endpoint 建立基准，再审计另一个 OpenAI-compatible endpoint：

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

指纹结果只是统计证据。差异可能来自模型更新、路由、量化、缓存或隐藏 reasoning。API key 只从环境变量读取，Qwake 不会保存它。

## 深入阅读

- [博客与使用指南](https://qwake.top/zh-CN/blog/)
- [模型指纹设计文档](design/model-fingerprinting-design.md)
- [完整 CLI 命令](https://qwake.top/zh-CN/)
- [参与贡献](CONTRIBUTING.md)

```bash
qwake --help
qwake fingerprint --help
```

## 开发

```bash
pnpm install
pnpm build
pnpm test
```

采用 Apache-2.0 许可证。
