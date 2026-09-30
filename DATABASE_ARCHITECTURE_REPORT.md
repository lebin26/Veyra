# Veyra Database Architecture Audit & Synchronization Report

**Inspection Date**: 2026-09-30  
**Environment**: Cloudflare Pages / Workers Edge + Cloudflare D1 SQLite + Windows Local SQLite  
**Auditor**: Antigravity AI Engineering Engine

---

## 1. Executive Summary

A comprehensive architectural audit was conducted across the Veyra repository to identify the current database topology, storage locations, synchronization scripts, security vulnerabilities, and data-loss risks.

The findings reveal:
1. **Cloudflare D1 Name Mismatch**: `wrangler.toml` specifies `database_name = "veyra-db"`, whereas Cloudflare D1's actual remote database name in the user's account (`b49b7ba58fb7a3584251c16dc34c18d4`) is **`veyra`** (UUID: `0f431065-816e-41e4-b428-43d59ac1a090`).
2. **Empty Remote Database**: Remote Cloudflare D1 `veyra` only contains system table `_cf_KV` and empty tables `users`, `sessions`. There are **0 user records** in production D1, which explains why online login was failing.
3. **Disjoint Local Database**: Local development has been creating and querying a root `veyra.db` file (with 10 tables and user `lebin26`), while legacy batch scripts (`push-db.bat`, `pull-db.bat`) mixed up temporary files (`d1/local_data.sql`, `d1/remote_export.sql`, `d1/backup.sql`) without backup or confirmation safeguards.
4. **No Unified CLI Workflow**: The project lacked a standard `package.json` with `npm run db:*` automation scripts, requiring users to manually run multiple python and batch files.

---

## 2. Current Architecture & Configurations

| Component | Current State | Target Standard Architecture |
| :--- | :--- | :--- |
| **Worker / Pages Config** | `wrangler.toml` (`name = "veyra"`) | Standardized `wrangler.toml` targeting `database_name = "veyra"` |
| **D1 Binding** | `DB` | `DB` (Functions access via `context.env.DB`) |
| **D1 Database Name** | `veyra-db` in `wrangler.toml` vs `veyra` in Cloudflare | **`veyra`** (Aligned across config and Cloudflare) |
| **D1 Database ID** | `0f431065-816e-41e4-b428-43d59ac1a090` | `0f431065-816e-41e4-b428-43d59ac1a090` (Confirmed active) |
| **Local SQLite Location** | `veyra.db` (in project root) | `database/local.sqlite` (canonical location, with symlink/fallback) |
| **Schema Definition** | `d1/schema.sql` (10 tables) | `database/schema.sql` + versioned `database/migrations/` |
| **Backups** | Ad-hoc `.bak` files in root | Timestamped in `database/backups/` (git-ignored) |
| **CLI / Scripts** | Ad-hoc `.bat` & `scripts/*.py` | `package.json` (`npm run db:*`) + robust PowerShell scripts |

---

## 3. Discovered Problems & Vulnerabilities

### Problem 1: Database Name Mismatch (`veyra-db` vs `veyra`)
In `wrangler.toml` line 11:
```toml
database_name = "veyra-db"
database_id = "0f431065-816e-41e4-b428-43d59ac1a090"
```
When running commands like `wrangler d1 execute veyra-db --remote`, Wrangler either fails or attempts to resolve a database named `veyra-db` which does not match the actual Cloudflare D1 entry `veyra`. This caused confusion during push and pull actions.

### Problem 2: The Cause of "Why I Still Cannot Log In"
* Live verification via `wrangler d1 execute veyra --remote --command="SELECT * FROM users;"` returned **0 rows**.
* The cloud database was completely unpopulated.
* The local user `lebin26` only existed inside the untracked local file `veyra.db`.
* No safe, validated pipeline existed to populate remote D1 from local, or vice versa.

### Problem 3: Data-Loss & Destructive Replacement Risks
* Previous scripts (`push-db.bat`) executed raw SQL files directly to remote D1 with **no user confirmation**, **no prior cloud backup**, and **no schema validation**.
* An accidental run could wipe out live trade logs and user accounts in production.

### Problem 4: Hardcoded Passwords in Temporary Scripts
* `scripts/init_local_db.py` contained hardcoded plaintext test passwords in commit history.
* Scripts need to accept arguments or generate clean cryptographically secure salts without committing credentials to Git.

---

## 4. Recommended Target Architecture

### Directory Structure
```text
database/
├── local.sqlite            # Canonical local SQLite database (git-ignored)
├── schema.sql              # Master canonical SQLite/D1 schema
├── migrations/             # Versioned schema migrations
│   └── 0001_initial_schema.sql
├── backups/                # Local and Remote timestamped backups (git-ignored)
│   ├── local-YYYY-MM-DD-HHMMSS.sqlite
│   └── remote-YYYY-MM-DD-HHMMSS.sql
└── README.md               # Quick manual for database operations

scripts/
├── db-status.ps1           # Verifies integrity, table counts, cloud & local status
├── db-pull.ps1             # Remote D1 -> Local SQLite (with auto-backup)
├── db-push.ps1             # Local SQLite -> Remote D1 (safe migration & upsert)
├── db-replace-prod.ps1     # Explicit full remote overwrite (strict confirmation)
├── db-backup.ps1           # Standalone one-key backup for both local & remote
└── db-reset.ps1            # Reset local SQLite from schema cleanly
```

### CLI Command Mapping (via `package.json`)
```json
{
  "scripts": {
    "db:status": "powershell -ExecutionPolicy Bypass -File ./scripts/db-status.ps1",
    "db:backup": "powershell -ExecutionPolicy Bypass -File ./scripts/db-backup.ps1",
    "db:pull": "powershell -ExecutionPolicy Bypass -File ./scripts/db-pull.ps1",
    "db:push": "powershell -ExecutionPolicy Bypass -File ./scripts/db-push.ps1",
    "db:replace-production": "powershell -ExecutionPolicy Bypass -File ./scripts/db-replace-prod.ps1",
    "db:reset": "powershell -ExecutionPolicy Bypass -File ./scripts/db-reset.ps1"
  }
}
```

---

## 5. Security & Git Safety Invariants
1. `database/local.sqlite`, `database/backups/`, and `*.db` are strictly added to `.gitignore`.
2. No sensitive credentials, tokens, or plaintext passwords will be output by `npm run db:status`.
3. Any remote operation requires verified Cloudflare authentication (`wrangler whoami`).
4. Full remote replacement will require typing `YES_REPLACE_PRODUCTION` to prevent accidental execution.
