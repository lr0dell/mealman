import { Command } from 'commander';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { DataStore } from '../data';
import {
  listPantry,
  formatPantryList,
  addPantryItem,
  removePantryItem,
  getExpiringItems,
  formatExpiringList,
} from '../commands';

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
    .action(async (name: string, quantity: string, unit: string, options: { expires?: string }) => {
      const store = new DataStore(getDataDir());
      await store.init();
      await addPantryItem(store, name, parseFloat(quantity), unit, options.expires);
      console.log(`Added ${quantity} ${unit} of ${name}`);
    });

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
    .action(() => {
      console.log('Weekly plan - coming in Phase 6');
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

  // Profile management (placeholders)
  const profile = program
    .command('profile')
    .description('Manage your profile and preferences');

  profile
    .command('show')
    .description('Show current profile')
    .action(() => {
      console.log('Profile show - coming in Phase 7');
    });

  profile
    .command('update')
    .description('Interactive profile update')
    .action(() => {
      console.log('Profile update - coming in Phase 7');
    });

  return program;
}