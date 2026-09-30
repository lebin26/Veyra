import sqlite3
import os
import sys

def main():
    if len(sys.argv) < 3:
        print("FAILED|Usage: dump_sqlite.py <source_db> <out_sql> [--replace-mode]")
        return
    source_path = sys.argv[1]
    out_sql = sys.argv[2]
    replace_mode = "--replace-mode" in sys.argv

    try:
        conn = sqlite3.connect(source_path)
        os.makedirs(os.path.dirname(os.path.abspath(out_sql)), exist_ok=True)
        with open(out_sql, 'w', encoding='utf-8') as f:
            for line in conn.iterdump():
                if 'sqlite_sequence' in line:
                    continue
                # Cloudflare D1 does not allow manual SQL transactions; it handles transactions at the HTTP/D1 isolate level
                clean_line = line.strip().upper()
                if clean_line in ("BEGIN TRANSACTION;", "COMMIT;", "BEGIN;", "END TRANSACTION;", "SAVEPOINT"):
                    continue
                if not replace_mode:
                    if line.startswith('CREATE TABLE ') and 'CREATE TABLE IF NOT EXISTS ' not in line:
                        line = line.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ', 1)
                    if line.startswith('CREATE INDEX ') and 'CREATE INDEX IF NOT EXISTS ' not in line:
                        line = line.replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ', 1)
                    if line.startswith('CREATE UNIQUE INDEX ') and 'CREATE UNIQUE INDEX IF NOT EXISTS ' not in line:
                        line = line.replace('CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS ', 1)
                    if line.startswith('INSERT INTO '):
                        line = line.replace('INSERT INTO ', 'INSERT OR REPLACE INTO ', 1)
                f.write(f"{line}\n")
        conn.close()
        print("SUCCESS")
    except Exception as e:
        print(f"FAILED|{e}")

if __name__ == "__main__":
    main()
