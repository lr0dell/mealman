import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataStore } from '../data';
import { formatProfile } from './profile';
import { createDefaultProfile } from '../schemas/defaults';

describe('Profile Commands', () => {
  const testDir = join(process.cwd(), 'test-data-profile');
  let store: DataStore;

  beforeEach(async () => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    store = new DataStore(testDir);
    await store.init();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('formatProfile', () => {
    it('formats profile for display', () => {
      const profile = createDefaultProfile();
      profile.goals.dailyCalories.max = 2500;
      profile.dietary.restrictions = ['gluten-free'];

      const output = formatProfile(profile);

      expect(output).toContain('2500');
      expect(output).toContain('gluten-free');
      expect(output).toContain('Household');
    });
  });
});
