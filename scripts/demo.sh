#!/usr/bin/env sh
set -eu

if command -v pnpm >/dev/null 2>&1; then
  pnpm install
  pnpm dev
elif command -v npm >/dev/null 2>&1; then
  npm install
  npm run dev
else
  echo "AdPilot requires Node.js 22+ with npm or pnpm."
  exit 1
fi
