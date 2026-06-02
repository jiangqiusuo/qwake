# Qwake 发布与开源流程

这份文档用于把 Qwake 从本地可用项目推进到公开开源、npm 发布和独立站上线。

## 产品定位

Qwake 是一个 local-first 的 AI 编码工具额度窗口唤醒器。它会在指定时间向本机 AI coding CLI 发送极小 wake 请求，让用户不用醒着、不用打开 agent，也能尝试启动或检查 provider 的额度窗口。

Qwake 不是 quota bypass 工具。它不绕过限制、不上传代码、不管理账号，只调用用户本机已经可用的 `claude`、`codex` 或自定义 CLI。

当前版本的定时唤醒默认启用 smart window guard：系统调度可以按多个墙钟时间检查，但只有当距离该 agent 上一次成功 wake 已经过了 `5 小时 + buffer` 时，才会真正调用 provider。未到窗口时会记录 `status=skipped`，避免重复消耗 live provider 调用。

## Slogan 候选

- Wake your AI coding quota before you need it.
- Start quota windows while you sleep.
- Tiny scheduled wake calls for Claude Code, Codex, and custom AI CLIs.
- No daemon, no cloud, no quota bypass. Just scheduled wake calls.
- A local-first wake scheduler for AI coding agents.
- 在你开始工作前，先唤醒 AI 编码额度。
- 睡觉时，也可以启动额度窗口。

## 本地正式使用流程

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
npm install -g .
qwake doctor
qwake wake mock
qwake wake claude
qwake schedule install claude --times 06:05,11:10,16:15,21:20
qwake schedule status claude
qwake schedule run claude
qwake schedule logs claude
```

确认 smart mode：

```bash
qwake wake mock --smart
qwake wake mock --smart
```

第二次应输出 `status=skipped`，并包含 `lastSuccessAt` 和 `nextWakeAt`。

取消定时任务：

```bash
qwake schedule uninstall claude
```

卸载本地全局包：

```bash
npm uninstall -g qwake
```

## npm 发布前检查

```bash
pnpm test
pnpm typecheck
pnpm build
npm pack --dry-run
```

确认 npm 包包含：

- `dist/`
- `README.md`
- `README.zh-CN.md`
- `LICENSE`
- `package.json`

生成正式 tarball：

```bash
npm pack
```

本地验证 tarball：

```bash
npm install -g ./qwake-0.1.0.tgz
qwake doctor
qwake wake mock
qwake wake mock --smart
```

## npm 发布流程

1. 登录 npm：

```bash
npm login
```

2. 确认包名：

```bash
npm view qwake
```

如果返回 404，通常表示包名可用。

3. 发布：

```bash
npm publish --access public
```

4. 验证安装：

```bash
npm install -g qwake
qwake --help
qwake doctor
```

## GitHub 开源流程

1. 在 GitHub 创建公开仓库，例如 `qwake`。

2. 本地提交：

```bash
git add .
git commit -m "Initial Qwake MVP"
```

3. 添加远端：

```bash
git remote add origin git@github.com:<your-user-or-org>/qwake.git
```

4. 推送：

```bash
git branch -M main
git push -u origin main
```

5. 设置仓库信息：

- Description: `Local-first quota window waker for AI coding agents`
- Website: 独立站 URL
- Topics: `ai`, `claude`, `codex`, `cli`, `quota`, `scheduler`, `local-first`

6. 创建第一个 tag：

```bash
git tag v0.1.0
git push origin v0.1.0
```

然后在 GitHub Releases 中创建 release，关联 npm 包链接。

## 独立站结构

独立站在 `site/` 目录，使用 Astro：

```text
site/
  astro.config.mjs
  package.json
  src/
    pages/
      index.astro
      zh-CN/index.astro
      robots.txt.ts
      llms.txt.ts
    components/
    layouts/
    styles/
```

本地开发：

```bash
cd site
pnpm install
pnpm dev
```

构建：

```bash
cd site
pnpm build
pnpm preview
```

## Vercel 部署流程

1. 将代码推送到 GitHub。
2. 在 Vercel 中 Import Project。
3. Root Directory 选择：

```text
site
```

4. Build Command：

```bash
pnpm build
```

5. Output Directory：

```text
dist
```

6. 环境变量：

```text
PUBLIC_SITE_URL=https://your-domain.com
PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
PUBLIC_GSC_VERIFICATION=your-google-search-console-token
```

`PUBLIC_GA_MEASUREMENT_ID` 和 `PUBLIC_GSC_VERIFICATION` 可以先不填，后续接入 GA/GSC 时再配置。

## SEO / GEO / LLM SEO 实践

站点已经预留：

- `title` 和 `description`
- canonical URL
- `hreflang` 中英文互链
- Open Graph tags
- Twitter card tags
- `SoftwareApplication` JSON-LD
- `FAQPage` JSON-LD
- `HowTo` JSON-LD
- sitemap
- robots.txt
- llms.txt
- GA 环境变量预留
- GSC verification 环境变量预留

GEO/LLM SEO 的内容原则：

- 明确说明 Qwake 是什么：AI coding quota window waker。
- 明确说明不是什么：不是 quota bypass，不破解额度。
- 使用具体命令示例，让搜索引擎和 AI 摘要可以准确理解用法。
- 保持 FAQ 问答直接、可引用。
- 同步维护中英文页面，使用 hreflang 避免语言页面互相竞争。

## 独立站上线前要替换的链接

在 `site/src/data/site.ts` 中替换：

```ts
export const SITE_URL = "https://qwake.dev";
export const GITHUB_URL = "https://github.com/your-org/qwake";
export const NPM_URL = "https://www.npmjs.com/package/qwake";
```

同时在 Vercel 配置：

```text
PUBLIC_SITE_URL=https://你的域名
```

## 推荐发布顺序

1. 本地跑通 `qwake wake mock`、`qwake wake mock --smart` 和 `qwake schedule install mock`。
2. 完成 README 和 RELEASE 文档。
3. 推送 GitHub 公开仓库。
4. 部署 Vercel 独立站。
5. 发布 npm。
6. 在 GitHub Release 中关联 npm 和独立站。
7. 提交 Google Search Console sitemap。

## 表述边界

推荐说法：

> Qwake sends tiny scheduled wake calls to your local AI coding CLI so quota windows can start before you sit down to work.

> Qwake uses a smart local window guard to skip redundant provider calls inside the configured quota window.

Windows 当前支持边界：

- 支持：`npm install -g qwake` 后通过 `qwake.cmd` / `.bat` wrapper / Task Scheduler 手动接入。
- 支持：`schtasks` 创建固定时间或每 5 小时触发的任务。
- 暂不支持：`qwake schedule install` 自动写入 Windows Task Scheduler。

安全边界：

- Qwake 命令不需要用户输入 API key、token 或密钥。
- Qwake 不管理 provider 凭证，只调用本机已经配置好的 `claude`、`codex` 或 custom command。
- 不要把密钥写进 `.bat`、cron、plist 或 Task Scheduler action。

避免说法：

- bypass limits
- unlock quota
- hack refresh windows
- avoid provider rules
- 破解额度
- 绕过限制
