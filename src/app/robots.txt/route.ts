const BODY = `# Content-Signal declares AI/search usage preferences per contentsignals.org
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-Agent: *
Allow: /
Allow: /login
Allow: /register
Allow: /blog
Allow: /blog/feed.xml
Allow: /faq
Allow: /how-it-works
Allow: /changelog
Allow: /privacy
Allow: /skill/
Allow: /.well-known/
Allow: /api/search
Allow: /api/methodology
Allow: /api/health
Allow: /ticker/
Disallow: /dashboard
Disallow: /trending
Disallow: /connections
Disallow: /performance
Disallow: /portfolio
Disallow: /profile
Disallow: /subscription
Disallow: /admin
Disallow: /paper-trading
Disallow: /results
Disallow: /api/

Sitemap: https://signalscopes.com/sitemap.xml
`;

export function GET() {
  return new Response(BODY, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
