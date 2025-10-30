# Git Repository Setup

## Central Repository

This monorepo uses a **single central Git repository** at the root level. All sub-repositories have been removed and consolidated.

## Removed Sub-Repositories

The following sub-repositories were removed:
- `services/search/.git` (was DIME-AI-SEARCH-API)
- `services/brightdata/.git` (was penny-bd)
- `DIME-AI-DB/.git`
- `webhook-tradingview-bot/.git`
- `maple-bot/trading-bot-dev-main/.git`

## Current Structure

```
/home/michaelvu/
├── .git/                    # Central repository (ROOT)
├── .gitignore              # Ignore patterns
├── .gitleaks.toml          # Secret detection
├── .gitattributes           # Line ending normalization
├── .git/info/exclude       # Personal exclude patterns
│
├── env/                    # Environment profiles (TRACKED)
├── packages/               # Shared packages (TRACKED)
├── services/              # All services (TRACKED)
├── scripts/                # Helper scripts (TRACKED)
└── ...
```

## Git Configuration

### Files Tracked
- Configuration files (`.gitignore`, `.gitleaks.toml`, etc.)
- Environment profiles (`env/.env.*` - except `.env.prod` and `.env.staging`)
- Source code in `packages/`, `services/`, `scripts/`
- Documentation (`README.md`, `MIGRATION.md`)

### Files Ignored
- Local environment overrides (`.env.local`, `.env.*.local`)
- Virtual environments (`venv/`, `.venv/`)
- Build artifacts (`__pycache__/`, `*.pyc`, `artifacts/`)
- Data files (`*.parquet`, `*.db`, `dump.rdb`)
- Logs (`logs/`, `*.log`)
- Personal config (`.cursor/`, `.vscode/`, `.idea/`)

## Initial Commit

To create your initial commit:

```bash
git add .
git commit -m "Initial monorepo structure with centralized config"
```

## Branch Strategy

Consider using a branch strategy like:
- `main` or `master` - Production-ready code
- `develop` - Development branch
- Feature branches - `feature/feature-name`
- Hotfix branches - `hotfix/fix-name`

## Remote Setup

To connect to a remote repository:

```bash
git remote add origin <your-repo-url>
git branch -M main  # or master
git push -u origin main
```

## Secret Protection

- `.gitleaks.toml` - Prevents committing secrets
- `.gitignore` - Ignores `.env.prod` and `.env.staging`
- `.git/info/exclude` - Additional personal excludes

## Workflow

1. **Make changes** in any service or package
2. **Stage changes**: `git add .`
3. **Commit**: `git commit -m "Description"`
4. **Push**: `git push origin main`

All services are now part of a single unified repository with shared history.

