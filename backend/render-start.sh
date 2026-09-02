#!/usr/bin/env bash
# Render start script — avoids the VIRTUAL_ENV mismatch warning from uv.
set -euo pipefail
cd "$(dirname "$0")"
unset VIRTUAL_ENV
exec uv run uvicorn backend.app:app --host 0.0.0.0 --port "${PORT:?}"
