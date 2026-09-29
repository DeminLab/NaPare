#!/usr/bin/env bash
set -euo pipefail

: "${PUBLIC_APP_URL:?Set PUBLIC_APP_URL to the deployed HTTPS website origin}"
base_url="${PUBLIC_APP_URL%/}"
case "$base_url" in
  https://*) ;;
  http://localhost*|http://127.0.0.1*) ;;
  *) echo "Use HTTPS for the public MAX endpoint." >&2; exit 2 ;;
esac

output="deliverables/educational-solutions/openapi.json"
mkdir -p "$(dirname "$output")"
temporary="${output}.tmp"
trap 'rm -f "$temporary"' EXIT
curl --fail --show-error --silent "$base_url/api/v1/docs-json" --output "$temporary"
node -e "const fs=require('node:fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!/^3\\./.test(d.openapi||''))process.exit(1);if(!d.paths||!d.paths['/api/v1/auth/max']||!d.paths['/api/v1/absences/attendance/qr-check-in'])process.exit(1)" "$temporary"
mv "$temporary" "$output"
trap - EXIT
printf 'Saved generated OpenAPI spec to %s\n' "$output"
