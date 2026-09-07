const EARTH_RADIUS_KM = 6_371.0088;
const KILOMETERS_PER_MILE = 1.609344;

export type GeographicCoordinate = readonly [longitude: number, latitude: number];

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Returns the great-circle distance between two points on Earth. */
export function greatCircleDistanceKm(from: GeographicCoordinate, to: GeographicCoordinate): number {
  const [fromLongitude, fromLatitude] = from;
  const [toLongitude, toLatitude] = to;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const fromLatitudeRadians = toRadians(fromLatitude);
  const toLatitudeRadians = toRadians(toLatitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitudeRadians) * Math.cos(toLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;
  const clampedHaversine = Math.min(1, Math.max(0, haversine));
  const centralAngle = 2 * Math.atan2(Math.sqrt(clampedHaversine), Math.sqrt(1 - clampedHaversine));
  return EARTH_RADIUS_KM * centralAngle;
}

function roundForApproximation(value: number): number {
  if (value < 10) return Math.round(value * 10) / 10;
  if (value < 100) return Math.round(value);
  return Math.round(value / 5) * 5;
}

export function approximateDistance(
  from: GeographicCoordinate,
  to: GeographicCoordinate,
): { kilometers: number; miles: number } {
  return approximateRouteDistance([from, to]);
}

export function approximateRouteDistance(
  coordinates: readonly GeographicCoordinate[],
): { kilometers: number; miles: number } {
  let kilometers = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const from = coordinates[index - 1];
    const to = coordinates[index];
    if (from && to) kilometers += greatCircleDistanceKm(from, to);
  }

  return {
    kilometers: roundForApproximation(kilometers),
    miles: roundForApproximation(kilometers / KILOMETERS_PER_MILE),
  };
}
