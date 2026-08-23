import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getWeekRange,
  toWeekKey,
  parseWeekKey,
  getWeekDates,
  getCurrentWeekKey,
  getWeekdayName,
} from './week.js';

describe('week utilities', () => {
  describe('getWeekRange', () => {
    it('returns Monday-Sunday range for a Monday', () => {
      const date = new Date('2026-01-26T12:00:00'); // Monday
      const range = getWeekRange(date);
      expect(range).toEqual({ start: '2026-01-26', end: '2026-02-01' });
    });

    it('returns Monday-Sunday range for a Wednesday', () => {
      const date = new Date('2026-01-28T12:00:00'); // Wednesday
      const range = getWeekRange(date);
      expect(range).toEqual({ start: '2026-01-26', end: '2026-02-01' });
    });

    it('returns Monday-Sunday range for a Sunday', () => {
      const date = new Date('2026-02-01T12:00:00'); // Sunday
      const range = getWeekRange(date);
      expect(range).toEqual({ start: '2026-01-26', end: '2026-02-01' });
    });

    it('handles year boundaries', () => {
      const date = new Date('2025-12-31T12:00:00'); // Wednesday
      const range = getWeekRange(date);
      expect(range).toEqual({ start: '2025-12-29', end: '2026-01-04' });
    });

    it('defaults to current date', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-10T12:00:00')); // Tuesday
      const range = getWeekRange();
      expect(range).toEqual({ start: '2026-02-09', end: '2026-02-15' });
      vi.useRealTimers();
    });
  });

  describe('toWeekKey', () => {
    it('joins start and end with --', () => {
      expect(toWeekKey({ start: '2026-01-26', end: '2026-02-01' })).toBe(
        '2026-01-26--2026-02-01'
      );
    });
  });

  describe('parseWeekKey', () => {
    it('splits key into start and end', () => {
      expect(parseWeekKey('2026-01-26--2026-02-01')).toEqual({
        start: '2026-01-26',
        end: '2026-02-01',
      });
    });
  });

  describe('getWeekDates', () => {
    it('returns 7 dates from Monday to Sunday', () => {
      const dates = getWeekDates('2026-01-26--2026-02-01');
      expect(dates).toEqual([
        '2026-01-26',
        '2026-01-27',
        '2026-01-28',
        '2026-01-29',
        '2026-01-30',
        '2026-01-31',
        '2026-02-01',
      ]);
    });
  });

  describe('getCurrentWeekKey', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns current week as key', () => {
      vi.setSystemTime(new Date('2026-02-10T12:00:00'));
      expect(getCurrentWeekKey()).toBe('2026-02-09--2026-02-15');
    });
  });
});

describe('getWeekdayName', () => {
  it('names each day of a week without drifting across the date boundary', () => {
    const dates = getWeekDates('2026-08-24--2026-08-30');

    expect(dates.map(getWeekdayName)).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]);
  });
});
