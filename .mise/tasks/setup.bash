#!/usr/bin/env bash
#MISE description="install deps and init project"
set -o pipefail -o errexit -o nounset
npm install
hk install
mise run build-ingredient-db