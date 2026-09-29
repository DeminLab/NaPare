#!/usr/bin/env bash

set -euo pipefail

base_url="${MAX_PUBLIC_URL:-https://napare.sano.ru}"
base_url="${base_url%/}"

fetch_page() {
  curl --fail --silent --show-error --location --max-time 20 "$1"
}

root_html="$(fetch_page "$base_url/")"
max_html="$(fetch_page "$base_url/max/")"

landing_marker='Цифровая среда университета'
bridge_marker='max-web-app.js'
failed=0

if ! grep -Fq "$landing_marker" <<< "$root_html"; then
  echo "The public root did not return the NaPare landing page: $base_url/" >&2
  failed=1
fi

if ! grep -Fq "$bridge_marker" <<< "$root_html"; then
  echo "The public root does not load MAX Bridge; deploy the current web-portal build: $base_url/" >&2
  failed=1
fi

if ! grep -Fq "$landing_marker" <<< "$max_html"; then
  if grep -Fq '/max/assets/' <<< "$max_html"; then
    echo "The MAX route still serves the retired standalone Vite mini-app: $base_url/max/" >&2
  else
    echo "The MAX route did not return the NaPare landing page: $base_url/max/" >&2
  fi
  failed=1
fi

if ! grep -Fq "$bridge_marker" <<< "$max_html"; then
  echo "The MAX route does not load MAX Bridge: $base_url/max/" >&2
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "MAX route serves the same NaPare landing page as the public root: $base_url/max/"
