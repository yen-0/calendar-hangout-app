import { describe, expect, it } from 'vitest';
import { estimateTravel, haversineKm } from '../travelEstimate';

// Known Tokyo landmarks for the regression checks below.
const SHIBUYA = { lat: 35.6595, lng: 139.7005 }; // Shibuya station area
const SHINJUKU = { lat: 35.6896, lng: 139.7006 }; // Shinjuku station area (~3.3 km north)
const TOKYO_STATION = { lat: 35.6812, lng: 139.7671 }; // ~6 km east of Shibuya

describe('haversineKm', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineKm(SHIBUYA, SHIBUYA)).toBeLessThan(0.001);
  });

  it('Shibuya → Shinjuku is roughly 3.3 km', () => {
    const d = haversineKm(SHIBUYA, SHINJUKU);
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThan(4);
  });

  it('is symmetric', () => {
    expect(haversineKm(SHIBUYA, TOKYO_STATION)).toBeCloseTo(
      haversineKm(TOKYO_STATION, SHIBUYA),
      6,
    );
  });
});

describe('estimateTravel', () => {
  it('walk Shibuya → Shinjuku is under an hour and at least 30 min', () => {
    const r = estimateTravel(SHIBUYA, SHINJUKU, 'walk');
    expect(r.minutes).toBeGreaterThanOrEqual(30);
    expect(r.minutes).toBeLessThan(60);
  });

  it('transit beats walking for the same trip', () => {
    const walk = estimateTravel(SHIBUYA, SHINJUKU, 'walk');
    const transit = estimateTravel(SHIBUYA, SHINJUKU, 'transit');
    expect(transit.minutes).toBeLessThan(walk.minutes);
  });

  it('returns at least 1 minute even for tiny distances', () => {
    const here = { lat: 35.6595, lng: 139.7005 };
    const veryNear = { lat: 35.6596, lng: 139.7006 };
    const r = estimateTravel(here, veryNear, 'walk');
    expect(r.minutes).toBeGreaterThanOrEqual(1);
  });

  it('rounds distance to one decimal place', () => {
    const r = estimateTravel(SHIBUYA, TOKYO_STATION, 'transit');
    // 6 km × 1.25 routing factor ≈ 7.5 km — exact to one decimal
    expect(Number.isFinite(r.distanceKm)).toBe(true);
    expect(r.distanceKm * 10).toBeCloseTo(Math.round(r.distanceKm * 10), 6);
  });
});
