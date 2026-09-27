#!/usr/bin/env bash
# Render start — do NOT use "uv run" here (it rebuilds and exits on Render).
set -euo pipefail
cd "$(dirname "$0")"
unset VIRTUAL_ENV

if [[ ! -x ".venv/bin/python" ]]; then
  echo "ERROR: .venv not found — run render-build.sh during build first." >&2
  exit 1
fi

# Render terminates TLS at its proxy and forwards the real client address in
# X-Forwarded-For; trust it so per-IP throttling sees the caller, not the proxy.
# Restrict FORWARDED_ALLOW_IPS to the proxy's address range if the service is
# ever reachable without going through that proxy.
exec .venv/bin/python -m uvicorn backend.app:app --host 0.0.0.0 --port "${PORT:?}" \
  --proxy-headers --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}"
