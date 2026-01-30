# AI Meal Planner - Design Document

**Date:** 2026-01-29
**Status:** Approved

## Overview

A CLI-first local application that uses Claude to generate personalized weekly meal plans. Designed to overcome limitations of existing tools like EatThisMuch by leveraging agentic AI for nuanced planning: predictive leftover management, contextual understanding of preferences and constraints, restaurant meal integration, and evolving user profiles.

## Goals

- Plan meals that hit macro and calorie targets across the week
- Stay within a specified weekly budget
- Use pantry items intelligently, especially those expiring soon
- Handle real-life disruptions (eating out, skipped meals, no leftovers)
- Learn from user feedback over time
- Ground AI decisions in real data (actual prices, verified nutrition)

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────┐
│              CLI Interface              │
│  (Commander.js - commands & output)     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│          AI Planning Engine             │
│  (Context assembly, Claude API calls,   │
│   response validation, file updates)    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│            Data Layer                   │
│  (Local JSON files - profile, pantry,   │
│   plans, history, knowledge tables)     │
└─────────────────────────────────────────┘
```

### Data Flow

1. User issues CLI command
2. Engine assembles context from local files
3. Engine sends structured prompt to Claude API
4. Claude returns structured plan/response
5. Engine validates and updates local files
6. CLI displays results

## Data Model

### File Structure

```
ai-meal-planner/
├── data/
│   ├── profile.json           # User preferences, constraints, goals
│   ├── pantry.json            # Current inventory
│   ├── knowledge/
│   │   ├── ingredients.json   # Price, calories, macros per ingredient
│   │   └── meals.json         # Restaurant/prepared food estimates
│   ├── plans/
│   │   └── 2026-W05.json      # Weekly plans (one per week)
│   └── history/
│       └── 2026-01.json       # Monthly history logs
```

### Profile Schema

```json
{
  "household": {
    "size": 2,
    "members": [
      { "name": "User", "dietaryRestrictions": [] },
      { "name": "Partner", "dietaryRestrictions": ["vegetarian"] }
    ]
  },
  "goals": {
    "dailyCalories": 2000,
    "macros": { "protein": 150, "carbs": 200, "fat": 70 },
    "weeklyBudget": 150
  },
  "dietary": {
    "restrictions": ["nut-allergy"],
    "dislikes": ["olives", "blue cheese"]
  },
  "preferences": {
    "cuisines": ["thai", "mexican", "mediterranean"],
    "maxPrepTime": { "weekday": 30, "weekend": 60 },
    "complexityTolerance": "medium"
  },
  "constraints": {
    "kitchenware": ["instant-pot", "air-fryer", "basic"],
    "skillLevel": "intermediate"
  },
  "learned": {
    "lovedMeals": [],
    "dislikedMeals": [],
    "patterns": []
  }
}
```

### Pantry Schema

```json
{
  "items": [
    {
      "name": "chicken breast",
      "quantity": 2,
      "unit": "lbs",
      "addedDate": "2026-01-27",
      "expirationDate": "2026-02-01"
    }
  ]
}
```

### Knowledge Tables Schema

```json
{
  "ingredients": {
    "chicken breast": {
      "pricePerUnit": 4.50,
      "unit": "lb",
      "calories": 165,
      "protein": 31,
      "carbs": 0,
      "fat": 3.6,
      "lastUpdated": "2026-01-20",
      "source": "manual"
    }
  }
}
```

### Weekly Plan Schema

```json
{
  "week": "2026-W05",
  "generatedAt": "2026-01-29T10:00:00Z",
  "days": [
    {
      "date": "2026-01-27",
      "meals": {
        "breakfast": {
          "name": "Greek yogurt with berries",
          "recipe": "...",
          "ingredients": [...],
          "prepTime": 5,
          "calories": 350,
          "macros": { "protein": 20, "carbs": 40, "fat": 10 },
          "estimatedCost": 3.50,
          "servings": 1,
          "leftoverOf": null
        },
        "lunch": { ... },
        "dinner": { ... }
      }
    }
  ],
  "totals": {
    "calories": 14000,
    "macros": { "protein": 1050, "carbs": 1400, "fat": 490 },
    "estimatedCost": 142.50
  }
}
```

## CLI Commands

### Planning

```bash
# Generate next week's plan
meal plan week

# Regenerate just today
meal plan today

# Adjust plan with natural language
meal plan adjust "eating out Thursday dinner"
meal plan adjust "swap Tuesday dinner for something faster"
meal plan adjust "out of chicken, have tofu instead"
```

### Pantry Management

```bash
# Add items (natural language parsed)
meal pantry add "2 lbs chicken breast, expires Feb 1"
meal pantry add "1 dozen eggs"

# Remove items
meal pantry remove "chicken breast"

# View pantry
meal pantry list
meal pantry expiring  # Items expiring within 3 days
```

### Logging

```bash
# Log meals eaten
meal log meal "lunch: leftover stir fry"
meal log meal "skipped breakfast"

# Log restaurant meals
meal log restaurant "chipotle burrito bowl with guac"

# Provide feedback
meal log feedback "loved the Thai curry"
meal log feedback "dinner was too complicated"
meal log feedback "chicken thighs are $3.50/lb at Costco"
```

### Shopping

```bash
# Generate shopping list for current plan
meal shop list

# Mark as purchased (adds to pantry)
meal shop bought
```

### Profile

```bash
# View current profile
meal profile show

# Interactive profile update
meal profile update
```

## Weekly Planning Flow

### 1. Context Gathering

Engine assembles:
- User profile (goals, constraints, preferences, learned patterns)
- Current pantry with expiration dates highlighted
- Calendar hints (logged restaurant plans, known busy days)
- Recent history (last 2-3 weeks of meals, recent feedback)
- Knowledge tables (ingredient prices, nutrition data)

### 2. AI Planning Request

Claude receives full context and instructions to generate a 7-day plan that:
- Hits macro/calorie targets across the week (daily flexibility allowed)
- Stays within weekly budget
- Uses pantry items, prioritizing those expiring soon
- Plans leftovers intentionally (e.g., batch cook Sunday → lunches Mon/Tue)
- Respects time constraints (quick meals on busy weeknights)
- Varies cuisines and avoids recent repeats
- Accommodates household dietary differences

### 3. Structured Output

Claude returns structured JSON plan. Engine validates:
- All required fields present
- Totals match individual meal sums
- Budget and macro targets within acceptable range
- Ingredients reference known items or flag new ones

### 4. Review and Adjust

Plan displayed to user. Options:
- Approve as-is
- Request regeneration with specific changes
- Make targeted swaps

## Mid-Week Adjustment Flows

### Planned Restaurant Meal

```bash
meal plan adjust "eating out Friday dinner"
```

1. Remove Friday dinner from plan
2. Recalculate weekly macros/budget
3. Optionally adjust surrounding meals to compensate

### Unplanned Restaurant Meal

```bash
meal log restaurant "pizza and beer with friends"
```

1. Estimate calories/macros from description
2. Check knowledge tables for known items
3. Log to history
4. Recalculate remaining weekly budget
5. Optionally suggest adjustments for remaining meals

### Leftover Correction

```bash
meal log feedback "finished all the stir fry, no leftovers"
```

1. Identify meals that planned to use those leftovers
2. Regenerate affected meals from pantry

### Ingredient Substitution

```bash
meal plan adjust "out of chicken, have tofu"
```

1. Find recipes using chicken
2. Swap to tofu
3. Update nutrition estimates

## Learning and Feedback System

### Explicit Signals

- Meal ratings: "loved it" / "it was okay" / "didn't like it"
- Recipe feedback: "too complicated", "not enough food"
- Data corrections: price updates, nutrition corrections

### Implicit Signals

- Meals frequently swapped → negative signal
- Meals repeated → positive signal
- Consistent patterns (e.g., always over on weekends)

### Profile Evolution

AI periodically analyzes patterns and proposes updates:

```
"I've noticed you swap out fish dishes 70% of the time.
Should I reduce fish frequency? (y/n)"
```

User confirms before any profile changes are applied.

### Knowledge Table Maintenance

- User corrections stored immediately
- Periodic prompts to verify stale data (prices older than 3 months)
- Future: automated web lookups to refresh data

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Language | TypeScript | Strong typing, JSON handling, web transition path |
| Runtime | Node.js | CLI-friendly, good ecosystem |
| CLI Framework | Commander.js | Lightweight, simple, sufficient for v1 |
| Data Storage | Local JSON | Human-readable, no setup, git-friendly |
| AI Integration | Anthropic SDK | Official TypeScript SDK, tool use for structured output |
| Validation | Zod | Runtime validation of AI responses |
| Terminal UI | Ink (optional) | Rich output (tables, colors) if needed |

## V1 Scope

### In Scope

- [x] User profile setup via interactive onboarding
- [x] Pantry management (add/remove/list/expiring)
- [x] Weekly meal plan generation with macro and budget targets
- [x] Mid-week adjustments via natural language
- [x] Restaurant meal logging with AI-estimated nutrition
- [x] Predictive leftover planning
- [x] Shopping list generation with cost estimates
- [x] Knowledge tables for ingredients
- [x] Feedback logging that updates profile

### Out of Scope (Future)

- [ ] Web or mobile interface
- [ ] Multiple LLM backends
- [ ] Grocery store API integrations
- [ ] Receipt scanning
- [ ] Multi-user household profiles
- [ ] Automated web scraping for prices
- [ ] Meal prep instructions / cooking mode
- [ ] Calendar integrations

## Success Criteria

1. Generate a week's meals that hit macro targets (within 10%)
2. Plans respect budget (within 5%)
3. Plans use pantry items, especially expiring ones
4. Adjustments feel conversational, not tedious
5. System noticeably improves over 4+ weeks of feedback

## Design Principles

1. **Real data over AI guesses** - Track actual prices, actual pantry, actual history. AI estimates are fallbacks, not primary sources.

2. **AI proposes, user confirms** - The system suggests patterns and changes, but the user stays in control.

3. **Graceful degradation** - Missing data shouldn't block planning. Use estimates, flag uncertainty, let user correct.

4. **Local-first** - All data stays on your machine. You control API costs. No accounts or cloud sync required.
