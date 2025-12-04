#!/bin/bash
# Wrapper script to run img-mcp from GitHub
set -e

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

cd "$TEMP_DIR"
curl -sSL https://raw.githubusercontent.com/arclabs561/img-mcp/master/package.json > package.json
curl -sSL https://raw.githubusercontent.com/arclabs561/img-mcp/master/tsconfig.json > tsconfig.json
mkdir -p src
curl -sSL https://raw.githubusercontent.com/arclabs561/img-mcp/master/src/index.ts > src/index.ts

npm install --silent
npx tsx src/index.ts "$@"
