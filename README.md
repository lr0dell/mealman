# mealman

An AI-powered meal planning CLI that generates a week of meals to hit your macro and budget targets, using your real pantry inventory and USDA nutrition data.

## What it does

`mealman` plans a week of breakfasts, lunches, and dinners that fit your nutrition goals (calories, protein, carbs, fat, fiber) and a weekly food budget. It knows what's already in your pantry, prioritizes ingredients that are about to expire, and produces a consolidated shopping list for whatever you're missing.

## How it works

Mealman uses an agent planning loop. It spins up an agent (via the Anthropic SDK), give it a set of tools, then lets it build the plan incrementally:

- It inspects the running state (`get_plan_state`, `check_daily_totals`) to see how current totals compare against daily targets and remaining budget.
- It adds meals one slot at a time (`add_meal`), looking up nutrition and price data per ingredient (`lookup_ingredient`) from the knowledge base.
- When totals drift off-target, it revises earlier meals (`modify_meal`) until the week balances.
- It signals completion with `finalize_plan`, noting any constraints it couldn't satisfy.

This makes meal planning a dynamic problem that an agent can solve in a human-like and creative manner with the ability to self-correct, rather than a pure constraint-satisfying algorithm.

### Ingredient search

Ingredient lookup is backed by a local semantic search layer: USDA food data is embedded with `Xenova/all-MiniLM-L6-v2` and stored in SQLite, which supports fuzzy matching ("chicken thigh" -> ranked USDA matches with similarity scores) and runs offline. When you add a pantry item, you get an interactive picker of the closest matches.


## Setup

Install [`mise`](https://mise.jdx.dev/getting-started.html) if necessary.

1. `mise setup`
2. Add `ANTHROPIC_API_KEY` to your `.env` (see `.env.example`)
3. `mise dev -- --help` or `mise build && mise start -- --help`

To use the `mealman` global binary instead of `mise start`, run `npm install -g .`.

## Usage

```
mealman pantry add <name> <quantity> <unit>   # searches against our database
mealman pantry list
mealman plan week                              # generate next week's plan
mealman plan view [target] --detailed         # view a plan, optionally with recipes + nutrition
mealman shop list                             # shopping list for the current plan
mealman profile show
```