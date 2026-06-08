import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataStore } from '../data/index.js';
import {
  formatProfile,
  parseList,
  formatList,
  validateNumber,
  validateRange,
} from './profile.js';
import { createDefaultProfile } from '../schemas/defaults.js';

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

  describe('profile update helpers', () => {
    describe('parseList', () => {
      it('splits a comma-separated string, trimming whitespace', () => {
        expect(parseList('vegan, gluten-free ,  nuts')).toEqual([
          'vegan',
          'gluten-free',
          'nuts',
        ]);
      });

      it('returns an empty array for an empty or whitespace string', () => {
        expect(parseList('')).toEqual([]);
        expect(parseList('   ')).toEqual([]);
      });

      it('drops empty entries from stray commas', () => {
        expect(parseList('a,,b,')).toEqual(['a', 'b']);
      });
    });

    describe('formatList', () => {
      it('joins with a comma and space', () => {
        expect(formatList(['vegan', 'nuts'])).toBe('vegan, nuts');
      });

      it('returns an empty string for an empty list', () => {
        expect(formatList([])).toBe('');
      });

      it('round-trips with parseList', () => {
        expect(parseList(formatList(['a', 'b', 'c']))).toEqual(['a', 'b', 'c']);
      });
    });

    describe('validateNumber', () => {
      it('accepts a non-negative number', () => {
        expect(validateNumber('0', { positive: false })).toBe(true);
        expect(validateNumber('42', { positive: false })).toBe(true);
      });

      it('rejects non-numeric input', () => {
        expect(validateNumber('abc', { positive: false })).toBe(
          'Please enter a number'
        );
        expect(validateNumber('', { positive: false })).toBe(
          'Please enter a number'
        );
      });

      it('rejects negatives', () => {
        expect(validateNumber('-1', { positive: false })).toBe(
          'Must be zero or greater'
        );
      });

      it('rejects zero and negatives when positive is required', () => {
        expect(validateNumber('0', { positive: true })).toBe(
          'Must be greater than zero'
        );
        expect(validateNumber('-3', { positive: true })).toBe(
          'Must be greater than zero'
        );
        expect(validateNumber('5', { positive: true })).toBe(true);
      });
    });

    describe('validateRange', () => {
      it('accepts max >= min', () => {
        expect(validateRange(1, 2)).toBe(true);
        expect(validateRange(2, 2)).toBe(true);
      });

      it('rejects max < min', () => {
        expect(validateRange(5, 3)).toBe(
          'Max must be greater than or equal to min'
        );
      });
    });
  });
});
