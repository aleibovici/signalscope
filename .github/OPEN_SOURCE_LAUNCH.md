# Open-source launch checklist

SignalScope is **public** as of 2026-07-25. Most GitHub OSS settings are applied; this doc records what was done at launch.

## Already configured (pre-launch, private repo)

- [x] Description, topics, MIT license
- [x] README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY
- [x] Issue templates + PR template (blank issues disabled via template config)
- [x] Dependabot version updates (`.github/dependabot.yml`)
- [x] Dependabot vulnerability alerts
- [x] CI workflow on push/PR
- [x] Squash merge only (merge commits and rebase disabled)
- [x] Delete branch on merge
- [x] Allow update branch on PRs
- [x] GitHub Actions restricted to selected actions (checkout, setup-node, dependabot/fetch-metadata)
- [x] CODEOWNERS for sensitive paths
- [x] Stale feature branch removed

## Applied at launch (public repo)

### 1. Branch protection on `main`

- [x] Required status check: `build-and-test` (strict)
- [x] Required PR review: 1 approval, dismiss stale reviews
- [x] `allow_force_pushes: true` (preserves single-commit amend workflow on `main`)

### 2. Secret scanning (free on public repos)

- [x] Secret scanning enabled
- [x] Secret scanning push protection enabled

### 3. Dependabot security updates

- [x] Automated security fixes enabled

### 4. Auto-merge

- [x] `allow_auto_merge: true` — Dependabot auto-merge workflow (`.github/workflows/dependabot-auto-merge.yml`) can enable PR auto-merge when checks pass

### 5. Actions cache cleanup

- [x] Purged stale npm caches from pre-launch PR branches (35 entries)

### 6. Release tag

- [x] `v0.1.0` points at current `main` (single commit: Initial open-source release)
- Release: https://github.com/aleibovici/signalscope/releases/tag/v0.1.0

### 7. Homepage URL (optional)

- [ ] Not set — add in **Settings → General → About** when a public demo or docs site exists

## Verify community health

```bash
gh api repos/aleibovici/signalscope/community/profile
```

Current: **100%** (issue template, PR template, license, README, contributing, code of conduct).

## Ongoing maintenance

- Dependabot may open security PRs for transitive dependencies (Next.js, Prisma, postcss, sharp, etc.). Some alerts may show `security_update_not_possible` until upstream fixes land or npm overrides are added — expected noise, not a launch blocker.
- When moving from single-commit `main` to normal merge history, consider setting `allow_force_pushes: false` on branch protection.
