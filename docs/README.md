# SignalScope documentation

Start here if you are exploring the repository on GitHub.

| Topic | Location |
|-------|----------|
| Overview & quick start | [README](../README.md) |
| Contributing | [CONTRIBUTING](../CONTRIBUTING.md) |
| Deployment & self-hosting | [DEPLOYMENT](../DEPLOYMENT.md) |
| Security reporting | [SECURITY](../SECURITY.md) |
| Code of conduct | [CODE_OF_CONDUCT](../CODE_OF_CONDUCT.md) |
| License | [LICENSE](../LICENSE) |

## Architecture notes

- **Web app** — Next.js UI, REST APIs, auth, ingest processing (`Dockerfile`, `npm run dev`)
- **Harvester** — separate process that fetches external signals and POSTs to `/api/harvest/ingest` (`Dockerfile.harvester`, `npm run harvest`)
- **Database** — PostgreSQL via Prisma (`prisma/schema.prisma`, migrations in `prisma/migrations/`)

## Support channels

- [GitHub Issues](https://github.com/aleibovici/signalscope/issues) — bugs and feature requests (use the templates)
- [GitHub Discussions](https://github.com/aleibovici/signalscope/discussions) — questions and ideas
- [Security Advisories](https://github.com/aleibovici/signalscope/security/advisories/new) — private vulnerability reports
