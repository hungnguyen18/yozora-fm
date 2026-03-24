import { computed } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { useGalaxyStore } from "@/stores/galaxy";

const GRID_SIZE = 50;
const R_MAX = 500;
const CELL_SIZE = (R_MAX * 2) / GRID_SIZE; // 20 world units per cell
const STORAGE_KEY = "yozora_explorer_passport";
const SAMPLE_INTERVAL_MS = 2000;

let samplerInstalled = false;

export const useExplorerPassport = () => {
  const galaxyStore = useGalaxyStore();

  // Persist as flat array of 0/1 (2500 bytes as JSON)
  const grid = useLocalStorage<number[]>(STORAGE_KEY, () =>
    new Array(GRID_SIZE * GRID_SIZE).fill(0),
  );

  const visitedCount = computed(() => {
    let count = 0;
    for (let i = 0; i < grid.value.length; i += 1) {
      if (grid.value[i] === 1) {
        count += 1;
      }
    }
    return count;
  });

  const totalCells = GRID_SIZE * GRID_SIZE;
  const completionPercent = computed(() =>
    Math.round((visitedCount.value / totalCells) * 100),
  );

  // Mark cells in the current viewport as visited
  const sampleViewport = () => {
    const zoom = galaxyStore.zoomLevel;
    const halfW = window.innerWidth / 2 / zoom;
    const halfH = window.innerHeight / 2 / zoom;

    const minX = galaxyStore.panX - halfW;
    const maxX = galaxyStore.panX + halfW;
    const minY = galaxyStore.panY - halfH;
    const maxY = galaxyStore.panY + halfH;

    const cellMinX = Math.max(0, Math.floor((minX + R_MAX) / CELL_SIZE));
    const cellMaxX = Math.min(
      GRID_SIZE - 1,
      Math.floor((maxX + R_MAX) / CELL_SIZE),
    );
    const cellMinY = Math.max(0, Math.floor((minY + R_MAX) / CELL_SIZE));
    const cellMaxY = Math.min(
      GRID_SIZE - 1,
      Math.floor((maxY + R_MAX) / CELL_SIZE),
    );

    let changed = false;
    for (let cy = cellMinY; cy <= cellMaxY; cy += 1) {
      for (let cx = cellMinX; cx <= cellMaxX; cx += 1) {
        const idx = cy * GRID_SIZE + cx;
        if (grid.value[idx] === 0) {
          grid.value[idx] = 1;
          changed = true;
        }
      }
    }

    // Only trigger reactivity if something actually changed
    if (changed) {
      grid.value = [...grid.value];
    }
  };

  // Start sampling every 2s (singleton)
  if (!samplerInstalled) {
    samplerInstalled = true;
    setInterval(sampleViewport, SAMPLE_INTERVAL_MS);
  }

  return {
    grid,
    visitedCount,
    totalCells,
    completionPercent,
    GRID_SIZE,
  };
};
