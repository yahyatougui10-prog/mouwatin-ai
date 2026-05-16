#!/bin/bash
echo "🇲🇦  Mouwatin AI — المساعد الإداري المغربي"
echo ""

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 est requis."
    exit 1
fi

if [ -f "$(dirname "$0")/.env" ]; then
    set -a
    source "$(dirname "$0")/.env"
    set +a
fi

cd "$(dirname "$0")"
python3 server.py
