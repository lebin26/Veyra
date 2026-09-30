#!/usr/bin/env python3
"""
scripts/db_manage.py - Veyra Local & Remote Database Manager
Directly manage local SQLite users and push/sync to Cloudflare D1.

Usage:
  python scripts/db_manage.py add-user <username> <password> [--role admin|user]
  python scripts/db_manage.py push [--local|--remote]
  python scripts/db_manage.py init [--local|--remote]
"""

import sys
import os
import argparse
import hashlib
import binascii
import subprocess
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
D1_DIR = os.path.join(PROJECT_ROOT, "d1")
SCHEMA_FILE = os.path.join(D1_DIR, "schema.sql")
LOCAL_DATA_FILE = os.path.join(D1_DIR, "local_data.sql")
DB_NAME = "veyra-db"

def hash_password(password: str):
    """Generate PBKDF2-SHA256 (310,000 iterations) salt and hash matching Veyra auth."""
    salt = os.urandom(32)
    hash_bytes = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310000)
    hash_hex = binascii.hexlify(hash_bytes).decode("utf-8")
    salt_hex = binascii.hexlify(salt).decode("utf-8")
    return hash_hex, salt_hex

def add_user(username: str, password: str, role: str = "admin", display_name: str = None):
    username_clean = username.strip().lower()
    if not display_name:
        display_name = username.strip()
    
    hash_hex, salt_hex = hash_password(password)
    user_id = f"usr_{int(time.time())}_{username_clean[:8]}"
    email = f"{username_clean}@veyra.app"

    sql_statement = f"""
-- User: {username_clean} ({role})
INSERT OR REPLACE INTO users (
    id, username, email, password_hash, password_salt, display_name, role, status, plan_id, must_change_password, created_at, updated_at
) VALUES (
    '{user_id}', '{username_clean}', '{email}', '{hash_hex}', '{salt_hex}', '{display_name}', '{role}', 'active', 'pro', 0, datetime('now'), datetime('now')
);
"""
    # Append to d1/local_data.sql
    os.makedirs(D1_DIR, exist_ok=True)
    with open(LOCAL_DATA_FILE, "a", encoding="utf-8") as f:
        f.write(sql_statement)
    
    print(f"[OK] Added user '{username_clean}' to {LOCAL_DATA_FILE}")
    print(f"     Role: {role}")
    print(f"     Password Hash generated with 310,000 PBKDF2-SHA256 iterations.")

def run_wrangler_d1(file_path: str, remote: bool = True):
    mode_flag = "--remote" if remote else "--local"
    target_desc = "Cloudflare Remote D1" if remote else "Local D1 SQLite"
    
    print(f"\n[*] Executing '{os.path.basename(file_path)}' on {target_desc} ({DB_NAME})...")
    
    # Ensure PATH contains node and global npm for Windows
    env = os.environ.copy()
    node_path = r"C:\Program Files\nodejs"
    npm_path = os.path.join(os.environ.get("APPDATA", ""), "npm")
    env["PATH"] = f"{node_path};{npm_path};{env.get('PATH', '')}"

    cmd = ["wrangler", "d1", "execute", DB_NAME, mode_flag, f"--file={file_path}"]
    
    # On Windows, resolve wrangler.cmd
    wrangler_cmd = os.path.join(npm_path, "wrangler.cmd")
    if os.path.exists(wrangler_cmd):
        cmd[0] = wrangler_cmd

    try:
        proc = subprocess.run(cmd, env=env, text=True, check=True)
        print(f"[OK] Successfully executed on {target_desc}!")
    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] Wrangler command failed (exit code {e.returncode}).")
        if remote:
            print("Note: If you have not logged in to Cloudflare, please run 'wrangler login' first.")
        sys.exit(1)
    except FileNotFoundError:
        print("[ERROR] 'wrangler' command not found. Please ensure Node.js and Wrangler are in PATH.")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Veyra Database Manager")
    subparsers = parser.add_subparsers(dest="command")

    # add-user
    parser_add = subparsers.add_parser("add-user", help="Add a user with hashed password to d1/local_data.sql")
    parser_add.add_argument("username", help="Username")
    parser_add.add_argument("password", help="Password")
    parser_add.add_argument("--role", choices=["admin", "user"], default="admin", help="User role (default: admin)")
    parser_add.add_argument("--push", action="store_true", help="Immediately push changes to remote D1")

    # push
    parser_push = subparsers.add_parser("push", help="Push d1/local_data.sql to Cloudflare D1")
    parser_push.add_argument("--local", action="store_true", help="Apply to local SQLite instead of remote D1")

    # init
    parser_init = subparsers.add_parser("init", help="Apply d1/schema.sql structure")
    parser_init.add_argument("--local", action="store_true", help="Apply to local SQLite instead of remote D1")

    args = parser.parse_args()

    if args.command == "add-user":
        add_user(args.username, args.password, args.role)
        if args.push:
            run_wrangler_d1(LOCAL_DATA_FILE, remote=True)
    elif args.command == "push":
        if not os.path.exists(LOCAL_DATA_FILE):
            print(f"[ERROR] '{LOCAL_DATA_FILE}' not found. Run 'add-user' first.")
            sys.exit(1)
        run_wrangler_d1(LOCAL_DATA_FILE, remote=not args.local)
    elif args.command == "init":
        run_wrangler_d1(SCHEMA_FILE, remote=not args.local)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
