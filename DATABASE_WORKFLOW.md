# Veyra Database Synchronization Workflow

This document defines the complete architectural lifecycle, safety rules, and day-to-day workflow for synchronizing databases between **Cloudflare D1 (Production)** and **Local SQLite (Development)**.

---

## 1. Architecture Overview

```text
       GitHub Repository
  (Code + d1/schema.sql only)
               │
               ▼
┌─────────────────────────────┐
│   Cloudflare D1 (Remote)    │ ◄──────────┐
│   Database: veyra (Binding: DB) │            │
└──────────────┬──────────────┘            │
               │                           │
         npm run db:pull             npm run db:push
               │                           │
               ▼                           │
┌─────────────────────────────┐            │
│    database/local.sqlite    │ ───────────┘
│   (Canonical Local SQLite)  │
│  [DB Browser / VS Code Ext] │
└─────────────────────────────┘
```

* **Production Database**: Cloudflare D1 database named `veyra` (UUID `0f431065-816e-41e4-b428-43d59ac1a090`).
* **Canonical Local Working Database**: `database/local.sqlite`.
* **Single Schema Source of Truth**: `d1/schema.sql`.
* **Git Repository**: Only tracks application code, scripts, and `d1/schema.sql`. **Never tracks SQLite binaries, dumps, or backups containing private user data.**

---

## 2. Available Commands

You can execute database operations using either `npm run` or direct PowerShell calls:

| NPM Command | PowerShell Equivalent | Description |
| :--- | :--- | :--- |
| `npm run db:status` | `.\scripts\db-status.ps1` | Inspect local SQLite integrity, tables, users, and Cloudflare D1 connectivity. |
| `npm run db:backup` | `.\scripts\db-backup.ps1` | Takes timestamped snapshot backups of both local SQLite and remote Cloudflare D1. |
| `npm run db:pull` | `.\scripts\db-pull.ps1` | Exports Cloudflare D1 and rebuilds `database/local.sqlite` (auto-backs up local first). |
| `npm run db:push` | `.\scripts\db-push.ps1` | Safely synchronizes new/updated local records to Cloudflare D1 with confirmation & remote backup. |
| `npm run db:replace` | `.\scripts\db-replace.ps1` | **[DESTRUCTIVE]** Full production overwrite. Requires typing `YES_REPLACE_PRODUCTION`. |

---

## 3. Daily Developer Workflows

### Scenario A: Start of Day — Get Latest Production Data
To pull fresh cloud data into your local workspace:
```bash
npm run db:pull
```
**Safety Workflow Executed Automatically**:
1. Creates local backup at `database/backups/local-YYYY-MM-DD-HH-mm.sqlite`.
2. Downloads production D1 snapshot via Wrangler into `database/.tmp/remote_export.sql`.
3. Reconstructs `database/local.sqlite` using SQLite transactional import.
4. Executes `PRAGMA integrity_check;` to ensure zero database corruption.
5. Deletes temporary files in `database/.tmp/`.

---

### Scenario B: Direct Local Editing
You can open and edit `database/local.sqlite` directly in your favorite GUI tool:
* **VS Code Extension**: `Database Client` (`cweijan.vscode-database-client2`)
* **Desktop App**: `DB Browser for SQLite` or `SQLiteStudio`
* **AI Agent**: Antigravity directly inspects and modifies `database/local.sqlite`.

---

### Scenario C: Verify Current State
Check tables, row counts, and remote connectivity:
```bash
npm run db:status
```
Example Output:
```text
LOCAL SQLite
------------
  Path:             database\local.sqlite
  Exists:           YES
  Size:             136 KB
  SQLite Integrity: OK
  Tables (10):      users, sessions, apps, user_app_overrides, audit_logs, trades, ...
  Rows:             users: 1 | trades: 0

CLOUDFLARE D1
-------------
  Database Name:    veyra
  Database ID:      0f431065-816e-41e4-b428-43d59ac1a090
  Binding:          DB
  Environment:      production
  Authentication:   OK (Authenticated)
  Remote Tables:    10
```

---

### Scenario D: Push Local Changes to Production
When you have created users, updated app overrides, or tuned local data and want to update Cloudflare D1:
```bash
npm run db:push
```
**Safeguards Executed**:
1. Verifies local SQLite integrity (`PRAGMA integrity_check`).
2. Creates an immediate safety snapshot of Cloudflare Remote D1 in `database/backups/remote-YYYY-MM-DD-HH-mm.sql`.
3. Displays a summary of records to be pushed and asks for interactive confirmation:
   `Synchronize these records into Cloudflare D1? (y/N)`
4. Applies non-destructive upserts (`INSERT OR REPLACE`) so existing remote data is not dropped.

---

### Scenario E: Complete Production Replacement
If and only if you intend to completely replace the production D1 database with your local SQLite database:
```bash
npm run db:replace
```
**Safeguards**:
* Automatically creates a remote backup snapshot first.
* Requires the developer to explicitly type:
  `YES_REPLACE_PRODUCTION`
* If anything else is entered, the process aborts immediately.

---

## 4. Git & Security Rules

1. **Ignored Patterns in `.gitignore`**:
   - `database/local.sqlite` and `database/local.sqlite*`
   - `database/backups/`
   - `database/.tmp/`
   - `*.db`, `*.sqlite`, `*.sqlite3`
   - `.env`, `.env.*`, and `.wrangler/`
2. **Zero Information Leakage**:
   - Password hashes, session tokens, and secrets are never printed to terminal logs.
   - Status reports display only table names, aggregate row counts, and health statuses.
3. **No Duplicate Schemas**:
   - `d1/schema.sql` is the sole canonical schema file. Never create copies in `database/schema.sql` or `src/schema.sql`.

---

## 5. Troubleshooting & FAQ

#### Q: Wrangler reports "Not authenticated" during push/pull
Run:
```powershell
.\cloudflare-login.bat
# or: npx wrangler login
```
Follow the browser prompt to authorize Wrangler with your Cloudflare account.

#### Q: "Database is locked" when running db:pull or db:push
Ensure that VS Code database extensions or external tools like DB Browser for SQLite have closed active transactions or connections to `database/local.sqlite`.
