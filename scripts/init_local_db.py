import sqlite3
import os
import hashlib
import binascii
import time

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(PROJECT_ROOT, "veyra.db")
SCHEMA_PATH = os.path.join(PROJECT_ROOT, "d1", "schema.sql")

def hash_password(password: str):
    salt = os.urandom(32)
    hash_bytes = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310000)
    return binascii.hexlify(hash_bytes).decode("utf-8"), binascii.hexlify(salt).decode("utf-8")

def main():
    print(f"Creating local SQLite database at: {DB_PATH}")
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    conn = sqlite3.connect(DB_PATH)
    conn.executescript(schema_sql)

    # Insert user lebin26 with PBKDF2-SHA256 password hash
    p_hash, p_salt = hash_password("12141214@Aa")
    user_id = f"usr_{int(time.time())}_lebin26"

    conn.execute("""
        INSERT OR REPLACE INTO users (
            id, username, email, password_hash, password_salt, display_name, role, status, plan_id, must_change_password
        ) VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active', 'pro', 0);
    """, (user_id, "lebin26", "lebin26@veyra.app", p_hash, p_salt, "lebin26"))
    conn.commit()

    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()]
    users = conn.execute("SELECT id, username, role, status FROM users;").fetchall()
    conn.close()

    print("SUCCESS! Created tables:", tables)
    print("Default user in veyra.db:", users)

if __name__ == "__main__":
    main()
