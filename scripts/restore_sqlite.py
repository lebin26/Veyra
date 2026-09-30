import sqlite3
import os
import sys
import shutil

def main():
    if len(sys.argv) < 3:
        print("FAILED|Usage: restore_sqlite.py <sql_dump> <target_db> [<legacy_db>]")
        return
    sql_path = sys.argv[1]
    target_path = sys.argv[2]
    legacy_path = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        with open(sql_path, "r", encoding="utf-8") as f:
            sql_content = f.read()

        temp_db = target_path + ".temp"
        if os.path.exists(temp_db):
            os.remove(temp_db)

        conn = sqlite3.connect(temp_db)
        conn.executescript(sql_content)
        conn.commit()

        check = conn.execute("PRAGMA integrity_check;").fetchone()[0]
        if check != "ok":
            raise Exception(f"Integrity check returned {check}")

        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()]
        u_count = conn.execute("SELECT COUNT(*) FROM users;").fetchone()[0] if "users" in tables else 0
        t_count = conn.execute("SELECT COUNT(*) FROM trades;").fetchone()[0] if "trades" in tables else 0
        conn.close()

        if os.path.exists(target_path):
            os.remove(target_path)
        os.rename(temp_db, target_path)

        if legacy_path:
            try:
                shutil.copy2(target_path, legacy_path)
            except Exception:
                pass

        print(f"SUCCESS|{len(tables)}|{u_count}|{t_count}|{','.join(tables)}")
    except Exception as e:
        print(f"FAILED|{e}")

if __name__ == "__main__":
    main()
