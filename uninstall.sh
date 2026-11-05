#!/bin/bash
# uninstall.sh — CTF v2 Tozalash skripti

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "CTF v2 tozalash jarayoni boshlandi..."

# Agar docker ishlayotgan bo'lsa
if which docker-compose &>/dev/null; then
    (cd "$SCRIPT_DIR" && docker-compose down 2>/dev/null || true)
fi

# Symlinklarni tozalash
if [ -w /usr/local/bin ]; then
    rm -f /usr/local/bin/check /usr/local/bin/status
fi

echo "CTF v2 to'xtatildi va tozalab qo'yildi."
