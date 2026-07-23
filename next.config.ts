import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/performance",
        destination: "/results/paper-trading",
        permanent: true,
      },
      {
        source: "/paper-trading",
        destination: "/results/paper-trading",
        permanent: true,
      },
      {
        source: "/results/simulated-portfolio",
        destination: "/results/paper-trading",
        permanent: true,
      },
      {
        source: "/results/signal-quality",
        destination: "/results/paper-trading",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/",
        headers: [
          {
            key: "Link",
            value:
              '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json", </skill/SKILL.md>; rel="service-doc"; type="text/markdown", </.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json", </.well-known/mcp/server-card.json>; rel="mcp-server-card"; type="application/json"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
