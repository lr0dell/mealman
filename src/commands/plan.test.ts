import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseViewTarget } from './plan.js';

describe('parseViewTarget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-03')); // A Monday in W06
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current week when target is empty', () => {
    const result = parseViewTarget();
    expect(result).toEqual({ type: 'week', week: '2026-W06' });
  });

  it('returns current week when target is undefined', () => {
    const result = parseViewTarget(undefined);
    expect(result).toEqual({ type: 'week', week: '2026-W06' });
  });

  it('returns current week and date for "today"', () => {
    const result = parseViewTarget('today');
    expect(result).toEqual({
      type: 'day',
      week: '2026-W06',
      date: '2026-02-03',
    });
  });

  it('returns week for valid week identifier', () => {
    const result = parseViewTarget('2026-W05');
    expect(result).toEqual({ type: 'week', week: '2026-W05' });
  });

  it('returns week for another valid week identifier', () => {
    const result = parseViewTarget('2025-W52');
    expect(result).toEqual({ type: 'week', week: '2025-W52' });
  });
});
