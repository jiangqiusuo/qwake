export function GET({ site }: { site: URL }) {
  const origin = site.toString().replace(/\/$/, "");
  return new Response(
    `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap-index.xml
`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    }
  );
}
