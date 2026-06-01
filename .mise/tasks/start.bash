#!/usr/bin/env bash
#MISE description="run the compiled app"
set -o pipefail -o errexit -o nounset
node dist/index.js