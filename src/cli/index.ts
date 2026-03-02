import { Command } from 'commander';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { DataStore } from '../data/index.js';
import {
  listPantry,
  formatPantryList,
  addPantryItem,
  removePantryItem,
  getExpiringItems,
  formatExpiringList,
  generateWeekPlan,
  formatProfile,
  generateShoppingList,
  formatShoppingList,
  viewPlan,
} from '../commands/index.js';
import select from '@inquirer/select';
import { IngredientDatabase } from '../services/ingredient-database.js';
import { getCurrentWeekKey, parseWeekKey } from '../utils/week.js';

function getDataDir(): string {
  return process.env.MEAL_DATA_DIR || join(homedir(), '.meal-planner', 'data');
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name('meal')
    .description('AI-powered meal planning CLI')
    .version('0.1.0');

  // Pantry management
  const pantry = program
    .command('pantry')
    .description('Manage your pantry inventory');

  pantry
    .command('list')
    .description('List all pantry items')
    .action(async () => {
      const store = new DataStore(getDataDir());
      await store.init();
      const items = await listPantry(store);
      console.log(formatPantryList(items));
    });

  pantry
    .command('add <name> <quantity> <unit>')
    .description('Add item to pantry')
    .option('-e, --expires <date>', 'Expiration date (YYYY-MM-DD)')
    .action(
      async (
        name: string,
        quantity: string,
        unit: string,
        options: { expires?: string }
      ) => {
        const store = new DataStore(getDataDir());
        await store.init();

        const dbPath = join(getDataDir(), 'ingredients.db');
        const ingredientDb = new IngredientDatabase(dbPath);
        await ingredientDb.init();

        try {
          const matches = await ingredientDb.searchIngredients(name, 5);

          if (matches.length === 0) {
            console.log(`No ingredients found matching "${name}".`);
            return;
          }

          const choices = matches.map((m) => ({
            name: `${m.ingredient.name} (${Math.round(m.similarity * 100)}% match)`,
            value: { id: m.ingredient.id, name: m.ingredient.name },
          }));

          const selected = await select({
            message: 'Select the ingredient to add:',
            choices: [...choices, { name: 'Cancel', value: null }],
          });

          if (!selected) {
            console.log('Cancelled.');
            return;
          }

          await addPantryItem(
            store,
            selected.id,
            selected.name,
            parseFloat(quantity),
            options.expires
          );
          console.log(`Added ${quantity} ${unit} of ${selected.name}`);
        } finally {
          ingredientDb.close();
        }
      }
    );

  pantry
    .command('remove <item>')
    .description('Remove an item from pantry')
    .action(async (item: string) => {
      const store = new DataStore(getDataDir());
      await store.init();
      const removed = await removePantryItem(store, item);
      if (removed) {
        console.log(`Removed ${item} from pantry`);
      } else {
        console.log(`Item "${item}" not found in pantry`);
      }
    });

  pantry
    .command('expiring')
    .description('Show items expiring within 3 days')
    .action(async () => {
      const store = new DataStore(getDataDir());
      await store.init();
      const items = await getExpiringItems(store);
      console.log(formatExpiringList(items));
    });

  // Meal planning (placeholders)
  const plan = program
    .command('plan')
    .description('Generate and manage meal plans');

  plan
    .command('week')
    .description('Generate next week plan')
    .action(async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error(
          'Error: ANTHROPIC_API_KEY environment variable is required'
        );
        process.exit(1);
      }

      const week = getCurrentWeekKey();
      const { start, end } = parseWeekKey(week);
      console.log(`Generating meal plan for ${start} to ${end}...`);

      try {
        await generateWeekPlan(getDataDir());
      } catch (error) {
        console.error('Failed to generate plan:', error);
        process.exit(1);
      }
    });

  plan
    .command('today')
    .description('Regenerate just today')
    .action(() => {
      console.log('Today plan - coming in Phase 6');
    });

  plan
    .command('adjust <description>')
    .description('Adjust plan with natural language')
    .action((description: string) => {
      console.log('Adjusting:', description, '- coming in Phase 6');
    });

  plan
    .command('view [target]')
    .description(
      'View meal plan (current week, specific week, date, or "today")'
    )
    .option(
      '-d, --detailed',
      'Show full details including recipes and nutrition'
    )
    .action(
      async (target: string | undefined, options: { detailed?: boolean }) => {
        const store = new DataStore(getDataDir());
        await store.init();

        try {
          const output = await viewPlan(store, target, options.detailed);
          console.log(output);
        } catch (error) {
          if (error instanceof Error) {
            console.error(error.message);
          } else {
            console.error('An error occurred');
          }
          process.exit(1);
        }
      }
    );

  // Profile management (placeholders)
  const profile = program
    .command('profile')
    .description('Manage your profile and preferences');

  profile
    .command('show')
    .description('Show current profile')
    .action(async () => {
      const store = new DataStore(getDataDir());
      await store.init();
      const userProfile = await store.getProfile();
      console.log(formatProfile(userProfile));
    });

  profile
    .command('update')
    .description('Interactive profile update')
    .action(() => {
      console.log('Profile update - coming in Phase 7');
    });

  const shop = program.command('shop').description('Shopping list management');

  shop
    .command('list')
    .description('Generate shopping list for current plan')
    .action(async () => {
      const store = new DataStore(getDataDir());
      await store.init();

      const week = getCurrentWeekKey();
      const plan = await store.getWeeklyPlan(week);

      if (!plan) {
        const { start, end } = parseWeekKey(week);
        console.log(
          `No plan found for ${start} to ${end}. Run 'meal plan week' first.`
        );
        return;
      }

      const pantry = await store.getPantry();
      const list = generateShoppingList(plan, pantry);
      console.log(formatShoppingList(list));
    });

  return program;
}
