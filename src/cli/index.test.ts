import { describe, it, expect } from 'vitest';
import { createProgram } from './index.js';
import type { Command } from 'commander';

describe('CLI Program', () => {
  it('creates a program with name and version', () => {
    const program = createProgram();
    expect(program.name()).toBe('meal');
    expect(program.version()).toBeDefined();
  });

  it('has pantry command', () => {
    const program = createProgram();
    const pantryCmd = program.commands.find(
      (c: Command) => c.name() === 'pantry'
    );
    expect(pantryCmd).toBeDefined();
  });

  it('has plan command', () => {
    const program = createProgram();
    const planCmd = program.commands.find((c: Command) => c.name() === 'plan');
    expect(planCmd).toBeDefined();
  });

  it('has profile command', () => {
    const program = createProgram();
    const profileCmd = program.commands.find(
      (c: Command) => c.name() === 'profile'
    );
    expect(profileCmd).toBeDefined();
  });
});
