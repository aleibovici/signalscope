# Open-source launch checklist

SignalScope stays **private** until you explicitly flip visibility. Most GitHub OSS settings below are already applied; a few require a **public** repository (or GitHub Pro on a private repo).

## Already configured (private repo)

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

## Apply when making the repository public

Run these once after **Settings → General → Change visibility → Public**:

### 1. Branch protection on `main`

```bash
gh api -X PUT repos/aleibovici/signalscope/branches/main/protection \
  -H "Content-Type: application/json" --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "checks": [{"context": "build-and-test"}]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": true,
  "allow_deletions": false
}
EOF
```

`allow_force_pushes: true` preserves maintainer ability to amend the single-commit `main` workflow. Consider setting it to `false` if you move to normal merge history.

### 2. Secret scanning (free on public repos)

```bash
gh api -X PATCH repos/aleibovici/signalscope \
  -H "Content-Type: application/json" --input - <<'EOF'
{
  "security_and_analysis": {
    "secret_scanning": {"status": "enabled"},
    "secret_scanning_push_protection": {"status": "enabled"}
  }
}
EOF
```

### 3. Dependabot security updates

```bash
gh api -X PUT repos/aleibovici/signalscope/automated-security-fixes
```

### 4. Auto-merge (optional)

If GitHub allows it on your plan after going public:

```bash
gh api -X PATCH repos/aleibovici/signalscope \
  -H "Content-Type: application/json" --input - '{"allow_auto_merge": true}'
```

The Dependabot auto-merge workflow (`.github/workflows/dependabot-auto-merge.yml`) checks this setting and skips gracefully while auto-merge is disabled.

### 5. Homepage URL (optional)

Set in **Settings → General → About** if you have a public demo or docs site.

## Verify community health

After going public, check:

```bash
gh api repos/aleibovici/signalscope/community/profile
```

Target: **100%** (issue template, PR template, license, README, contributing, code of conduct).
