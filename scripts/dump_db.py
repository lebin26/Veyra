import sqlite3
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(PROJECT_ROOT, "veyra.db")
OUTPUT_SQL = os.path.join(PROJECT_ROOT, "d1", "local_data.sql")

def main():
    if not os.path.exists(DB_PATH):
        print(f"[ERROR] '{DB_PATH}' not found.")
        return 1

    print(f"Dumping '{DB_PATH}' -> '{OUTPUT_SQL}'...")
    conn = sqlite3.connect(DB_PATH)
    with open(OUTPUT_SQL, "w", encoding="utf-8") as f:
        for line in conn.iterdump():
            # Skip sqlite_sequence or internal metadata if any
            if "sqlite_sequence" in line:
                continue
            f.write(f"{line}\n")
    conn.close()
    print("[SUCCESS] Dump complete!")
    return 0

if __name__ == "__main__":
    exit(main())
