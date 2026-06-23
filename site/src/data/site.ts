export const SITE_URL = "https://qwake.top";
export const GITHUB_URL = "https://github.com/jiangqiusuo/qwake";
export const NPM_URL = "https://www.npmjs.com/package/@sysiphus/qwake";

export type Locale = "en" | "zh-CN";

export const locales = {
  en: {
    path: "/",
    label: "English",
    htmlLang: "en"
  },
  "zh-CN": {
    path: "/zh-CN/",
    label: "简体中文",
    htmlLang: "zh-CN"
  }
} satisfies Record<Locale, { path: string; label: string; htmlLang: string }>;

export const content = {
  en: {
    title: "Qwake - AI Coding Quota Window Waker",
    description:
      "Qwake sends tiny scheduled wake calls to local AI coding CLIs like Claude Code, Codex, and custom providers.",
    nav: {
      features: "Features",
      install: "Install",
      schedule: "Schedule",
      blog: "Blog",
      faq: "FAQ",
      github: "GitHub"
    },
    hero: {
      eyebrow: "Local-first AI quota window waker",
      title: "Wake your AI coding quota before you need it.",
      body:
        "Schedule tiny wake calls for Claude Code, Codex, and custom provider CLIs so quota windows can start before you sit down to work.",
      primary: "Install Qwake",
      secondary: "View GitHub"
    },
    terminal: `$ qwake doctor
claude: ok (claude)
codex: ok (codex)

$ qwake schedule install codex claude \\
  --times 06:05,11:10,16:15,21:20
Installed schedule
Logs: ~/.qwake/logs/claude.log`,
    featuresTitle: "Built for quota-window friction",
    featuresBody:
      "Qwake is not a quota bypass tool. It is a small local scheduler that attempts honest wake requests and records the result.",
    features: [
      {
        title: "System-level scheduling",
        body: "Install LaunchAgent, schtasks, or Linux systemd/crontab schedules with one command. Scheduled wakes use smart 5h+buffer skipping by default."
      },
      {
        title: "Provider-neutral",
        body: "Use Claude Code, Codex, or any custom CLI, including third-party routes already configured locally."
      },
      {
        title: "Observable by default",
        body: "Check schedule status and logs without opening an agent session. Logs show success, failure, limited, or skipped."
      }
    ],
    installTitle: "Install",
    installBody: "Install globally after npm publish, or build from the repository during development.",
    installCode: `npm install -g @sysiphus/qwake
qwake doctor --fix
qwake schedule install codex claude \\
  --times 06:05,11:10,16:15,21:20`,
    scheduleTitle: "Schedule wake calls",
    scheduleBody:
      "Qwake does not stay resident. It delegates timing to the operating system and uses smart 5h+buffer skipping to avoid redundant provider calls.",
    scheduleCode: `qwake schedule install codex claude \\
  --times 06:05,11:10,16:15,21:20

qwake schedule status
qwake schedule doctor
qwake schedule test codex claude
qwake schedule repair codex claude
qwake schedule logs`,
    verifyTitle: "Verify scheduled wakes",
    verifyBody:
      "After installing a schedule, status and logs tell you whether launchd loaded it and whether wake calls succeeded.",
    verifyCode: `qwake schedule status
qwake schedule doctor
qwake schedule test codex claude
qwake schedule logs

# healthy log output
[2026-06-01 09:20:00 +08:00] wake agent=claude status=success exitCode=0 limited=false durationMs=1842 utc=2026-06-01T01:20:00.000Z
[2026-06-01 11:10:00 +08:00] wake agent=claude status=skipped exitCode=0 limited=false durationMs=3 utc=2026-06-01T03:10:00.000Z nextWakeAt=2026-06-01T06:25:00.000Z`,
    warning:
      "Qwake attempts wake requests and records timestamps. It cannot guarantee provider quota refresh if the machine is off, fully asleep, offline, or rejected by the provider.",
    blogTitle: "Cross-platform setup guide",
    blogBody:
      "Read the practical guide for macOS LaunchAgent, Linux systemd/crontab fallback, and Windows Task Scheduler workflows.",
    blogHref: "/blog/use-qwake-on-macos-windows-linux/",
    blogCta: "Read the guide",
    seoTitle: "How Qwake works",
    steps: [
      "Install Qwake globally with npm.",
      "Confirm your local Claude Code, Codex, or custom CLI works.",
      "Install schedules for the agents and wall-clock times you care about.",
      "Inspect logs after scheduled wake attempts."
    ],
    faqTitle: "FAQ",
    resourcesTitle: "Resources",
    repositoryLabel: "GitHub repository",
    npmLabel: "npm package",
    readmeLabel: "README",
    faqs: [
      {
        q: "Does Qwake bypass provider limits?",
        a: "No. Qwake sends tiny scheduled wake calls through your existing local CLI. It does not bypass, unlock, or hack provider quotas."
      },
      {
        q: "Does it require an official Claude or Codex account?",
        a: "No. Qwake calls whatever local command already works. If Claude Code routes to GLM, OpenRouter, Bedrock, Vertex, or another provider, Qwake uses that setup."
      },
      {
        q: "Will it spend tokens?",
        a: "wake and probe send tiny live requests and may spend a small amount of provider quota. Scheduled wakes use smart mode by default, so repeated checks inside the configured window are skipped."
      }
    ],
    ctaTitle: "Start quota windows while you sleep.",
    ctaBody: "A tiny local CLI for honest workflow continuity.",
    footer: "Apache-2.0 licensed. Built for honest workflow continuity."
  },
  "zh-CN": {
    title: "Qwake - AI 编码工具额度窗口唤醒器",
    description:
      "Qwake 会向 Claude Code、Codex 和自定义 provider CLI 发送极小的定时唤醒请求。",
    nav: {
      features: "特性",
      install: "安装",
      schedule: "定时",
      blog: "博客",
      faq: "FAQ",
      github: "GitHub"
    },
    hero: {
      eyebrow: "Local-first AI 额度窗口唤醒器",
      title: "在你开始工作前，先唤醒 AI 编码额度。",
      body:
        "为 Claude Code、Codex 和自定义 provider CLI 安排极小 wake 请求，让额度窗口在你坐下工作前就开始尝试启动。",
      primary: "安装 Qwake",
      secondary: "查看 GitHub"
    },
    terminal: `$ qwake doctor
claude: ok (claude)
codex: ok (codex)

$ qwake schedule install codex claude \\
  --times 06:05,11:10,16:15,21:20
Installed schedule
Logs: ~/.qwake/logs/claude.log`,
    featuresTitle: "为额度窗口的烦人中断而生",
    featuresBody:
      "Qwake 不是额度绕过工具。它是一个本地小型调度器，只负责尝试发送合规 wake 请求并记录结果。",
    features: [
      {
        title: "系统级定时",
        body: "一条命令安装 macOS LaunchAgent 定时任务。定时 wake 默认使用 5 小时 + buffer 的 smart skipping。"
      },
      {
        title: "不绑定 provider",
        body: "支持 Claude Code、Codex 或自定义 CLI，也兼容你本机已配置好的第三方路由。"
      },
      {
        title: "默认可观测",
        body: "不用打开 agent，也能查看 schedule status 和 logs，知道结果是 success、failed、limited 还是 skipped。"
      }
    ],
    installTitle: "安装",
    installBody: "发布到 npm 后可全局安装；开发阶段也可以从仓库构建。",
    installCode: `npm install -g @sysiphus/qwake
qwake doctor --fix
qwake schedule install codex claude \\
  --times 06:05,11:10,16:15,21:20`,
    scheduleTitle: "定时唤醒",
    scheduleBody:
      "Qwake 自己不常驻后台。它把定时交给操作系统，并用 5 小时 + buffer 的 smart skipping 避免重复调用 provider。",
    scheduleCode: `qwake schedule install codex claude \\
  --times 06:05,11:10,16:15,21:20

qwake schedule status
qwake schedule doctor
qwake schedule test codex claude
qwake schedule repair codex claude
qwake schedule logs`,
    verifyTitle: "确认定时唤醒是否运行",
    verifyBody:
      "安装 schedule 后，可以通过 status 和 logs 确认 launchd 是否已加载，以及 wake 是否成功执行。",
    verifyCode: `qwake schedule status
qwake schedule doctor
qwake schedule test codex claude
qwake schedule logs

# 健康日志输出
[2026-06-01 09:20:00 +08:00] wake agent=claude status=success exitCode=0 limited=false durationMs=1842 utc=2026-06-01T01:20:00.000Z
[2026-06-01 11:10:00 +08:00] wake agent=claude status=skipped exitCode=0 limited=false durationMs=3 utc=2026-06-01T03:10:00.000Z nextWakeAt=2026-06-01T06:25:00.000Z`,
    warning:
      "Qwake 能尝试发送 wake 请求并记录时间戳，但如果电脑关机、完全深度睡眠、断网，或 provider 拒绝请求，它不能保证额度一定刷新。",
    blogTitle: "跨平台使用指南",
    blogBody:
      "阅读 macOS LaunchAgent、Linux cron/systemd、Windows Task Scheduler 的实际使用方式。",
    blogHref: "/zh-CN/blog/use-qwake-on-macos-windows-linux/",
    blogCta: "阅读指南",
    seoTitle: "Qwake 如何工作",
    steps: [
      "用 npm 全局安装 Qwake。",
      "确认本机 Claude Code、Codex 或自定义 CLI 可用。",
      "为需要的 provider 和墙钟时间安装 schedule。",
      "在定时尝试后查看 logs。"
    ],
    faqTitle: "常见问题",
    resourcesTitle: "资源",
    repositoryLabel: "GitHub 仓库",
    npmLabel: "npm 包",
    readmeLabel: "README",
    faqs: [
      {
        q: "Qwake 会绕过 provider 限制吗？",
        a: "不会。Qwake 只通过你已有的本地 CLI 发送极小定时 wake 请求，不绕过、不解锁、不破解额度。"
      },
      {
        q: "必须使用官方 Claude 或 Codex 账号吗？",
        a: "不需要。Qwake 调用的是本机已可用命令。如果 Claude Code 路由到 GLM、OpenRouter、Bedrock、Vertex 或其他 provider，Qwake 会沿用这个设置。"
      },
      {
        q: "会消耗 token 吗？",
        a: "wake 和 probe 会发送极小 live request，可能消耗少量 provider 额度。定时 wake 默认使用 smart mode，因此窗口内的重复检查会被 skipped。"
      }
    ],
    ctaTitle: "睡觉时，也可以启动额度窗口。",
    ctaBody: "一个为工作流连续性而生的本地小 CLI。",
    footer: "Apache-2.0 开源许可。为诚实的工作流连续性而构建。"
  }
} satisfies Record<Locale, any>;
