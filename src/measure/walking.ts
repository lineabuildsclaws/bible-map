import { greatCircleDistanceKm, type GeographicCoordinate } from './distance';

export interface WalkingGrid {
  west: number; south: number; step: number; width: number; height: number;
  rows: string[]; edges: string[];
}

// A small binary heap keeps the land search responsive for long journeys.
class Frontier {
  private items: Array<[number, number]> = [];
  push(item: [number, number]): void {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent]![1] <= item[1]) break;
      this.items[i] = this.items[parent]!;
      i = parent;
    }
    this.items[i] = item;
  }
  pop(): [number, number] | undefined {
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length && last) {
      let i = 0;
      while (i * 2 + 1 < this.items.length) {
        let child = i * 2 + 1;
        if (child + 1 < this.items.length && this.items[child + 1]![1] < this.items[child]![1]) child++;
        if (this.items[child]![1] >= last[1]) break;
        this.items[i] = this.items[child]!;
        i = child;
      }
      this.items[i] = last;
    }
    return first;
  }
}

/** Coarse land-only estimate, without roads, terrain or historical-route claims. */
export function walkingPath(grid: WalkingGrid, stops: readonly GeographicCoordinate[]): GeographicCoordinate[] | undefined {
  const coordinate = (id: number): GeographicCoordinate => [grid.west + (id % grid.width) * grid.step, grid.south + Math.floor(id / grid.width) * grid.step];
  const snap = (point: GeographicCoordinate): number | undefined => {
    const x = Math.round((point[0] - grid.west) / grid.step);
    const y = Math.round((point[1] - grid.south) / grid.step);
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return undefined;
    let best: number | undefined;
    let distance = Infinity;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= grid.width || yy >= grid.height || grid.rows[yy]?.[xx] !== '1') continue;
      const id = yy * grid.width + xx;
      const d = greatCircleDistanceKm(point, coordinate(id));
      if (d < distance) { distance = d; best = id; }
    }
    return distance <= 20 ? best : undefined;
  };
  const result: GeographicCoordinate[] = [];
  for (let leg = 1; leg < stops.length; leg++) {
    const start = snap(stops[leg - 1]!), goal = snap(stops[leg]!);
    if (start === undefined || goal === undefined) return undefined;
    const size = grid.width * grid.height;
    const costs = new Float64Array(size).fill(Infinity);
    const previous = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);
    const frontier = new Frontier();
    costs[start] = 0;
    frontier.push([start, 0]);
    let found = false;
    for (let expansions = 0; expansions < size; expansions++) {
      const next = frontier.pop();
      if (!next) break;
      const current = next[0];
      if (closed[current]) { expansions--; continue; }
      if (current === goal) { found = true; break; }
      closed[current] = 1;
      const x = current % grid.width, y = Math.floor(current / grid.width);
      const directions = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      for (const [i, [dx, dy]] of directions.entries()) {
        const xx = x + dx!, yy = y + dy!;
        if (xx < 0 || yy < 0 || xx >= grid.width || yy >= grid.height) continue;
        // Forward four directions are encoded on this cell; reverse ones on its neighbor.
        const bits = parseInt(grid.edges[i < 4 ? y : yy]?.[i < 4 ? x : xx] ?? '0', 16);
        if (!(bits & (1 << (i % 4)))) continue;
        const neighbor = yy * grid.width + xx;
        const cost = costs[current]! + greatCircleDistanceKm(coordinate(current), coordinate(neighbor));
        if (cost >= costs[neighbor]!) continue;
        costs[neighbor] = cost;
        previous[neighbor] = current;
        frontier.push([neighbor, cost + greatCircleDistanceKm(coordinate(neighbor), coordinate(goal))]);
      }
    }
    if (!found) return undefined;
    const path: GeographicCoordinate[] = [];
    for (let id = goal; id !== -1; id = previous[id]!) path.push(coordinate(id));
    result.push(...path.reverse());
  }
  if (result.length === 1) result.push(result[0]!);
  return result;
}
