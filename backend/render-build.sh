#!/usr/bin/env bash
# Render build — run with Root Directory = backend
set -euo pipefail
cd "$(dirname "$0")"
unset VIRTUAL_ENV
pip install uv
uv sync --frozen
uv run alembic upgrade head
