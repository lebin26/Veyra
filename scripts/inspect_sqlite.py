import sqlite3
import sys

def main():
    if len(sys.argv) < 2:
        print("FAILED|Missing db path")
        return
    db_path = sys.argv[1]
    try:
        conn = sqlite3.connect(db_path)
        integrity = conn.execute("PRAGMA integrity_check;").fetchone()[0]
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()]
        u_count = conn.execute("SELECT COUNT(*) FROM users;").fetchone()[0] if 'users' in tables else 0
        t_count = conn.execute("SELECT COUNT(*) FROM trades;").fetchone()[0] if 'trades' in tables else 0
        conn.close()
        print(f"{integrity}|{len(tables)}|{u_count}|{t_count}|{','.join(tables)}")
    except Exception as e:
        print(f"FAILED|{e}")

if __name__ == "__main__":
    main()
