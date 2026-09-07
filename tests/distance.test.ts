import { describe, expect, it } from 'vitest';
import { approximateDistance, greatCircleDistanceKm } from '../src/measure/distance';

describe('straight-line distance', () => {
  it('returns zero for the same point', () => {
    expect(greatCircleDistanceKm([35.21, 31.77], [35.21, 31.77])).toBe(0);
  });

  it('uses a great-circle calculation', () => {
    expect(greatCircleDistanceKm([0, 0], [0, 1])).toBeCloseTo(111.2, 1);
  });

  it('is symmetric', () => {
    const firstToSecond = greatCircleDistanceKm([35.241389, 31.922778], [34.840833, 31.244722]);
    const secondToFirst = greatCircleDistanceKm([34.840833, 31.244722], [35.241389, 31.922778]);
    expect(firstToSecond).toBeCloseTo(secondToFirst, 10);
  });

  it('formats close distances with useful approximate precision', () => {
    expect(approximateDistance([35.241389, 31.922778], [35.261111, 31.916944])).toEqual({
      kilometers: 2,
      miles: 1.2,
    });
  });
});
