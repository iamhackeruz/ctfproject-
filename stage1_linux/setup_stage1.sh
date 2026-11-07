#!/bin/bash
# stage1_linux/setup_stage1.sh
# Kiberxavfsizlik CTF v2 — 1-Bosqich: Linux Tizim Auditi (Dinamik Token integratsiyasi)
# Foydalanish: bash setup_stage1.sh [username] [token]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

USERNAME=${1:-$(whoami)}
TOKEN=${2:-""}

# Agar token berilmagan bo'lsa, saqlangan tokenni olish
if [ -z "$TOKEN" ]; then
    if [ -f "/var/ctf/active_token.txt" ]; then
        TOKEN=$(cat /var/ctf/active_token.txt | tr -d '[:space:]')
    elif [ -f "$PROJECT_ROOT/.apex_token" ]; then
        TOKEN=$(cat "$PROJECT_ROOT/.apex_token" | tr -d '[:space:]')
    fi
fi

TOKEN=${TOKEN:-"APEX-DEFAULT"}

export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"
python3 "$SCRIPT_DIR/setup_stage1.py" "$USERNAME" "$TOKEN"
