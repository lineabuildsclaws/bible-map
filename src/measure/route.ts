import { approximateRouteDistance, type GeographicCoordinate } from './distance';
import { walkingPath, type WalkingGrid } from './walking';

/** Retain each leg's path so its displayed distance uses the same method as the total. */
export function measureRoute(stops: readonly GeographicCoordinate[], grid?: WalkingGrid): {
  path: GeographicCoordinate[];
  legs: Array<{ kilometers: number; miles: number }>;
  kilometers: number;
  miles: number;
} | undefined {
  const path: GeographicCoordinate[] = [];
  const legs: Array<{ kilometers: number; miles: number }> = [];
  for (let index = 1; index < stops.length; index++) {
    const endpoints = [stops[index - 1]!, stops[index]!];
    const leg = grid ? walkingPath(grid, endpoints) : endpoints;
    if (!leg) return undefined;
    const connected = grid ? [endpoints[0]!, ...leg, endpoints[1]!] : leg;
    legs.push(approximateRouteDistance(connected));
    path.push(...connected);
  }
  return { path, legs, ...approximateRouteDistance(path) };
}
