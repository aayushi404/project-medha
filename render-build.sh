#!/usr/bin/env bash
# Render build — use when Root Directory is blank (monorepo root).
set -euo pipefail
cd "$(dirname "$0")/backend"
unset VIRTUAL_ENV
pip install uv
uv sync --frozen
uv run alembic upgrade head
# idempotent content seeds (safe to re-run every deploy)
uv run python scripts/seed_library.py
