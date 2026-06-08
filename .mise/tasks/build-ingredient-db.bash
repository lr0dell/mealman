#!/usr/bin/env bash
#MISE description="download USDA data and build the ingredient db"
#USAGE flag "--force" help="rebuild even if db already exists"
set -o pipefail -o errexit -o nounset

DB_PATH="${MEAL_DATA_DIR:-$HOME/.meal-planner/data}/ingredients.db"

if [ "${usage_force:-}" != "true" ] && [ -f "$DB_PATH" ]; then
  echo "ingredients.db already exists at $DB_PATH, skipping (use --force to rebuild)"
  exit 0
fi

npx tsx scripts/build-ingredient-db.ts
npx tsx scripts/embed-ingredients.ts
