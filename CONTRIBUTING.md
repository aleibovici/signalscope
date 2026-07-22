# Contributing to SignalScope

Thanks for helping improve SignalScope. By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## How to contribute

1. Fork the repository and create a branch from `main`.
2. Make focused changes with clear commits.
3. Run checks locally before opening a pull request:

```bash
npm run lint
npm test
```

4. Open a PR against `main` describing the problem and solution.

## Development setup

Follow the [README](README.md) quick start (Postgres via Docker, env from `.env.example`, migrate + seed, `npm run dev`).

Remember the **harvester is a separate process** from the web app. Most UI work does not require running the harvester.

## Guidelines

- Do not commit secrets, API keys, or `.env` files.
- Prefer small, reviewable PRs.
- Match existing TypeScript, testing, and UI patterns in the repo.
- Add or update Vitest coverage when changing behavior.
- Maintainer discussion happens on GitHub Issues and PR threads — not via a project mailbox.

## Security

Do not open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).
