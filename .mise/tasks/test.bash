#!/usr/bin/env bash
#MISE description="run tests (watch mode by default)"
set -o pipefail -o errexit -o nounset
npx vitest "$@"
