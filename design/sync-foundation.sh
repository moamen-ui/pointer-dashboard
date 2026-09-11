#!/usr/bin/env sh
# Copies the canonical design/foundation.css into every app. Run after editing design/foundation.css.
set -e
cd "$(dirname "$0")/.."
for app in react vue angular; do
  mkdir -p "$app/src/styles"
  cp design/foundation.css "$app/src/styles/foundation.css"
  echo "synced -> $app/src/styles/foundation.css"
done
