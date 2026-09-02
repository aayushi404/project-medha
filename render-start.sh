#!/usr/bin/env bash
# Render start — use when Root Directory is blank (monorepo root).
set -euo pipefail
cd "$(dirname "$0")/backend"
unset VIRTUAL_ENV

if [[ ! -x ".venv/bin/python" ]]; then
  echo "ERROR: backend/.venv not found — check build command." >&2
  exit 1
fi

exec .venv/bin/python -m uvicorn backend.app:app --host 0.0.0.0 --port "${PORT:?}"
