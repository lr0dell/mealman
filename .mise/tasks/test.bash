#!/usr/bin/env bash
#MISE description="run tests (watch mode by default)"
#USAGE flag "-r" help="run once instead of watching"
set -o pipefail -o errexit -o nounset
if [ "${usage_r:-}" = "true" ]; then
  npx vitest run
else
  npx vitest
fi