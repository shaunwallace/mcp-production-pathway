#!/usr/bin/env bash
# Enforces the Week 2 constraint: the harness stays a test bench, not a framework.
# Run before tagging week-2-complete. Exits non-zero if the ceiling is breached.

set -euo pipefail

TARGET="harness/src/index.ts"
LIMIT=300

if [ ! -f "$TARGET" ]; then
  echo "error: $TARGET not found. Run this script from the repo root." >&2
  exit 2
fi

LINES=$(wc -l < "$TARGET" | tr -d ' ')

if [ "$LINES" -gt "$LIMIT" ]; then
  echo "FAIL: $TARGET is $LINES lines; ceiling is $LIMIT." >&2
  echo "      The harness is meant to be a test bench, not an agent framework." >&2
  echo "      If you're over, split a helper out or simplify — don't raise the limit." >&2
  exit 1
fi

echo "OK: $TARGET is $LINES / $LIMIT lines."
