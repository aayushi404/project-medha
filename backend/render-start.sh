#!/usr/bin/env bash
# Render start — do NOT use "uv run" here (it rebuilds and exits on Render).
set -euo pipefail
cd "$(dirname "$0")"
unset VIRTUAL_ENV

if [[ ! -x ".venv/bin/python" ]]; then
  echo "ERROR: .venv not found — run render-build.sh during build first." >&2
  exit 1
fi

exec .venv/bin/python -m uvicorn backend.app:app --host 0.0.0.0 --port "${PORT:?}"
