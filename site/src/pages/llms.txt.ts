export function GET({ site }: { site: URL }) {
  const origin = site.toString().replace(/\/$/, "");
  return new Response(
    `# Qwake

Qwake is a local-first AI coding quota window waker.

It sends tiny scheduled wake calls to local AI coding CLIs such as Claude Code, Codex, and custom provider commands. Qwake does not bypass provider limits, upload source code, or manage credentials.

Scheduled wakes use smart mode by default. Qwake stores the last successful wake locally and skips redundant provider calls inside the configured quota window, logging status=skipped with nextWakeAt.

Important URLs:
- Home: ${origin}/
- Chinese: ${origin}/zh-CN/
- GitHub: https://github.com/your-org/qwake
- npm: https://www.npmjs.com/package/qwake

Core commands:
- qwake doctor
- qwake wake claude
- qwake wake claude --smart
- qwake wake codex
- qwake schedule install claude --times 06:05,11:10,16:15,21:20
- qwake schedule status claude
- qwake schedule logs claude
`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    }
  );
}
