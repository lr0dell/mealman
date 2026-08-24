import { describe, it, expect } from 'vitest';
import { formatProfile, parseList, validateNumber } from './profile.js';
import { createDefaultProfile } from '../schemas/defaults.js';

describe('Profile Commands', () => {
  describe('formatProfile', () => {
    it('formats profile for display', () => {
      const profile = createDefaultProfile();
      profile.goals.dailyCalories = 2500;
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
  });
});
