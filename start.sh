#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "╔══════════════════════════════════════════════════════╗"
echo "║     🇲🇦  Mouwatin AI ·  مواطن AI  v2               ║"
echo "║     المساعد الإداري المغربي                           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 est requis. Installe-le avec : sudo apt install python3"
    exit 1
fi

PYTHON_VER=$(python3 --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
if [ "$(echo "$PYTHON_VER" | cut -d. -f1)" -lt 3 ] || { [ "$(echo "$PYTHON_VER" | cut -d. -f1)" -eq 3 ] && [ "$(echo "$PYTHON_VER" | cut -d. -f2)" -lt 10 ]; }; then
    echo "⚠️  Python 3.10+ recommandé (actuel : $PYTHON_VER)"
fi

# Load .env if present
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo "📄 Chargement de .env"
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

cd "$SCRIPT_DIR"
echo "🚀 Démarrage du serveur sur http://localhost:${PORT:-3000}"
echo ""

exec python3 server.py
