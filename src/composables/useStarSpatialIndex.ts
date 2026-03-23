import * as THREE from "three";

// Grid-based spatial index for fast nearest-star lookups.
// Divides the galaxy XY plane into cells of CELL_SIZE world units.
// Instead of iterating all 9111 stars per mouse move, only nearby cells are checked.

const CELL_SIZE = 50;

interface IGridCell {
  listIndex: number[];
}

export interface IStarSpatialIndex {
  // Rebuild the grid from an array of world positions (call after buildMesh)
  build: (listPosition: THREE.Vector3[]) => void;
  // Return star indices within a world-space radius of a point
  queryNear: (worldX: number, worldY: number, radius: number) => number[];
  // Clear the grid (e.g. on unmount)
  clear: () => void;
}

const cellKey = (cx: number, cy: number): string => `${cx},${cy}`;

export const useStarSpatialIndex = (): IStarSpatialIndex => {
  const grid = new Map<string, IGridCell>();
  let listPosition: THREE.Vector3[] = [];

  const build = (positions: THREE.Vector3[]): void => {
    grid.clear();
    listPosition = positions;

    for (let i = 0; i < positions.length; i += 1) {
      const pos = positions[i];
      const cx = Math.floor(pos.x / CELL_SIZE);
      const cy = Math.floor(pos.y / CELL_SIZE);
      const key = cellKey(cx, cy);

      let cell = grid.get(key);
      if (!cell) {
        cell = { listIndex: [] };
        grid.set(key, cell);
      }
      cell.listIndex.push(i);
    }
  };

  const queryNear = (
    worldX: number,
    worldY: number,
    radius: number,
  ): number[] => {
    const result: number[] = [];
    const radiusSq = radius * radius;

    // Determine the range of cells that could overlap with the search circle
    const minCx = Math.floor((worldX - radius) / CELL_SIZE);
    const maxCx = Math.floor((worldX + radius) / CELL_SIZE);
    const minCy = Math.floor((worldY - radius) / CELL_SIZE);
    const maxCy = Math.floor((worldY + radius) / CELL_SIZE);

    for (let cx = minCx; cx <= maxCx; cx += 1) {
      for (let cy = minCy; cy <= maxCy; cy += 1) {
        const cell = grid.get(cellKey(cx, cy));
        if (!cell) {
          continue;
        }

        for (let k = 0; k < cell.listIndex.length; k += 1) {
          const idx = cell.listIndex[k];
          const pos = listPosition[idx];
          const dx = pos.x - worldX;
          const dy = pos.y - worldY;
          if (dx * dx + dy * dy <= radiusSq) {
            result.push(idx);
          }
        }
      }
    }

    return result;
  };

  const clear = (): void => {
    grid.clear();
    listPosition = [];
  };

  return { build, queryNear, clear };
};
