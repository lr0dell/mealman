import { Command } from 'commander';

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
    .action(() => {
      console.log('Pantry list command - not yet implemented');
    });

  pantry
    .command('add <items...>')
    .description('Add items to pantry (natural language)')
    .action((items: string[]) => {
      console.log('Adding:', items.join(' '));
    });

  pantry
    .command('remove <item>')
    .description('Remove an item from pantry')
    .action((item: string) => {
      console.log('Removing:', item);
    });

  pantry
    .command('expiring')
    .description('Show items expiring within 3 days')
    .action(() => {
      console.log('Expiring items - not yet implemented');
    });

  // Meal planning
  const plan = program
    .command('plan')
    .description('Generate and manage meal plans');

  plan
    .command('week')
    .description('Generate next week plan')
    .action(() => {
      console.log('Weekly plan - not yet implemented');
    });

  plan
    .command('today')
    .description('Regenerate just today')
    .action(() => {
      console.log('Today plan - not yet implemented');
    });

  plan
    .command('adjust <description>')
    .description('Adjust plan with natural language')
    .action((description: string) => {
      console.log('Adjusting:', description);
    });

  // Profile management
  const profile = program
    .command('profile')
    .description('Manage your profile and preferences');

  profile
    .command('show')
    .description('Show current profile')
    .action(() => {
      console.log('Profile show - not yet implemented');
    });

  profile
    .command('update')
    .description('Interactive profile update')
    .action(() => {
      console.log('Profile update - not yet implemented');
    });

  return program;
}