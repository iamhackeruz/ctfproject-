#!/usr/bin/env python3
"""setup/clean_feed.py — Activity Feed xabarlaridan maxfiy tokenlarni tozalash"""
import os
import re
import sqlite3

DB_PATH = os.environ.get("CTF_DB_PATH", "/var/ctf/ctf_v2.db")


def main():
    if not os.path.exists(DB_PATH):
        print(f"[!] Baza topilmadi: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, message FROM activity_feed WHERE message LIKE '%Token:%'")
    rows = cur.fetchall()

    cleaned = 0
    for row_id, msg in rows:
        new_msg = re.sub(r"\s*\(Token:[^)]+\)", "", msg)
        cur.execute("UPDATE activity_feed SET message = ? WHERE id = ?", (new_msg, row_id))
        cleaned += 1

    conn.commit()
    conn.close()
    print(f"[+] Tayyor! {cleaned} ta xabardan tokenlar olib tashlandi.")


if __name__ == "__main__":
    main()
