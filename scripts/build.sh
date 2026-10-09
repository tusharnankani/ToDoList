#!/usr/bin/env sh
# Runs the tests and packages the app into dist/todolist-<version>.zip.
# Usage: sh scripts/build.sh [--skip-tests]
set -eu

SKIP_TESTS=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

VERSION=$(node -p "require('./package.json').version")
[ -n "$VERSION" ] || { echo "No version found in package.json" >&2; exit 1; }

if [ "$SKIP_TESTS" -eq 0 ]; then
  if [ ! -d node_modules ]; then
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
  fi
  npm test
fi

NAME="todolist-$VERSION"
DIST="$ROOT/dist"
STAGE="$DIST/$NAME"
ZIP="$DIST/$NAME.zip"

rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE/assets"

for item in index.html JS CSS backend db package.json package-lock.json README.md LICENSE \
            Dockerfile docker-compose.yml .dockerignore; do
  if [ -e "$item" ]; then
    cp -R "$item" "$STAGE/"
  fi
done
cp assets/favicon.png "$STAGE/assets/"

# Never ship a local database file.
rm -f "$STAGE"/db/*.sqlite "$STAGE"/db/*.sqlite-shm "$STAGE"/db/*.sqlite-wal

cd "$DIST"
if command -v zip >/dev/null 2>&1; then
  zip -qr "$NAME.zip" "$NAME"
elif python3 -c 'import zipfile' >/dev/null 2>&1; then
  python3 -m zipfile -c "$NAME.zip" "$NAME"
elif python -c 'import zipfile' >/dev/null 2>&1; then
  python -m zipfile -c "$NAME.zip" "$NAME"
else
  echo "Need 'zip' or Python to create the archive." >&2
  exit 1
fi

rm -rf "$STAGE"
echo "Created $ZIP"
