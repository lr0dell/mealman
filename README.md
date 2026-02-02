# Unnamed Meal Planner

## Setup

1. Install dependencies: `npm install`
2. Build the ingredient database: `npm run build-ingredient-db`
   - This downloads USDA food data and generates embeddings (~10 min)
3. Set up your `.env` file with `ANTHROPIC_API_KEY`
4. Run the app: `npm run dev`