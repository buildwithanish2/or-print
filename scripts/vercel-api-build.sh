#!/usr/bin/env bash
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

npm run build --workspace=packages/types
npm run build --workspace=packages/config
npm run build --workspace=packages/validation

# Prisma needs DATABASE_URL to validate the schema during client generation.
# Use an ephemeral build-only SQLite URL, never the production database URL.
DATABASE_URL='file:./vercel-build.db' npm run generate --workspace=apps/api

npm run build --workspace=apps/api
