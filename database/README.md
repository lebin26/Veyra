# Veyra Local Database & Schema Standard

This directory contains the developer's canonical local SQLite working copy, automated snapshots, and temporary runtime workspace.

## Directory Structure
```text
database/
├── local.sqlite            # Canonical local SQLite database (git-ignored)
├── backups/                # Timestamped safety backups for local & remote (git-ignored)
│   ├── local-YYYY-MM-DD-HH-mm.sqlite
│   └── remote-YYYY-MM-DD-HH-mm.sql
├── .tmp/                   # Ephemeral SQL sync payloads (auto-cleaned, git-ignored)
└── README.md
```

## Schema Source of Truth
- **Canonical Schema**: `d1/schema.sql` (single source of truth for both D1 and local development).
- **Target Remote Database**: Defined directly in `wrangler.toml` (`binding = "DB"`, `database_name = "veyra"`).

## Workflow Commands
All database commands are run from the project root via NPM scripts or directly in PowerShell:

```bash
# 1. Inspect local SQLite health and remote Cloudflare D1 connection
npm run db:status
# or: .\scripts\db-status.ps1

# 2. Pull remote Cloudflare D1 into database/local.sqlite (auto-backs up local first)
npm run db:pull
# or: .\scripts\db-pull.ps1

# 3. Create timestamped snapshot backups of both local and remote
npm run db:backup
# or: .\scripts\db-backup.ps1

# 4. Safely synchronize local SQLite changes into Cloudflare D1 (with confirmation & remote backup)
npm run db:push
# or: .\scripts\db-push.ps1

# 5. [DANGEROUS] Full destructive replacement of Cloudflare D1 from local SQLite
npm run db:replace
# or: .\scripts\db-replace.ps1
```
