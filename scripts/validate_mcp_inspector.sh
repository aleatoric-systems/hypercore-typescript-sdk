#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

npm run build >/dev/null

LOG_FILE="$(mktemp)"
cleanup() {
  rm -f "${LOG_FILE}"
}
trap cleanup EXIT

set +e
MCP_AUTO_OPEN_ENABLED=false timeout 15s npx -y @modelcontextprotocol/inspector node dist/mcp_cli.js >"${LOG_FILE}" 2>&1
STATUS=$?
set -e

cat "${LOG_FILE}"

if ! grep -q "Proxy server listening on localhost:6277" "${LOG_FILE}"; then
  echo "Inspector validation failed: proxy did not start." >&2
  exit 1
fi

if ! grep -q "MCP Inspector is up and running at:" "${LOG_FILE}"; then
  echo "Inspector validation failed: UI startup banner missing." >&2
  exit 1
fi

if [[ ${STATUS} -ne 0 && ${STATUS} -ne 124 ]]; then
  echo "Inspector validation failed: unexpected exit status ${STATUS}." >&2
  exit 1
fi

echo "Inspector validation passed."
