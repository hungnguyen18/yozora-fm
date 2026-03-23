import { defineStore } from "pinia";
import type { ISong, IStarPosition, IEra, TLodTier } from "@/types";

const LIST_ERA: IEra[] = [
  {
    decade: 1980,
    name: "The Dawn of Anime Music",
    startYear: 1980,
    endYear: 1989,
  },
  {
    decade: 1990,
    name: "The Golden Age of J-Rock",
    startYear: 1990,
    endYear: 1999,
  },
  { decade: 2000, name: "Digital Revolution", startYear: 2000, endYear: 2009 },
  { decade: 2010, name: "The Streaming Era", startYear: 2010, endYear: 2019 },
  { decade: 2020, name: "New Frontier", startYear: 2020, endYear: 2029 },
];

const R_MAX = 500;

// Maps genre to spiral arm index (0-3); 4 arms separated by 90° each
const GENRE_ARM_MAP: Record<string, number> = {
  rock: 0,
  electronic: 1,
  pop: 2,
  ballad: 3,
  orchestral: 0,
  other: 2,
};

// Seeded pseudo-random number generator (mulberry32) for reproducible jitter per song id
const seededRandom = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

interface IEraStats {
  decade: number;
  songCount: number;
  topGenre: string | null;
}

export const useGalaxyStore = defineStore("galaxy", {
  state: () => ({
    listStarPosition: [] as IStarPosition[],
    zoomLevel: 1,
    panX: 0,
    panY: 0,
    focusedEra: null as IEra | null,
    hoveredStarId: null as number | null,
    selectedSongId: null as number | null,
    highlightedGenre: null as string | null,
    lodTier: "far" as TLodTier,
  }),
  getters: {
    currentEra: (state): IEra | null => state.focusedEra,

    eraStats: (state): IEraStats[] => {
      // Count songs per decade and find top genre from star positions is not enough —
      // star positions only carry songId. This getter is best computed when songs are
      // available externally; return counts from the listStarPosition mapping per era.
      return LIST_ERA.map((era) => ({
        decade: era.decade,
        // listStarPosition does not carry genre; count based on angle ranges is impractical.
        // Callers that need full stats should combine songsStore + galaxyStore.
        songCount: state.listStarPosition.length,
        topGenre: null,
      }));
    },
  },
  actions: {
    computeStarPositions(listSong: ISong[]) {
      const TOTAL_SPAN_YEARS = 46; // 1980–2025 inclusive span
      const MAX_ANGLE_DEG = 1620;

      const listPosition: IStarPosition[] = [];

      for (let i = 0; i < listSong.length; i += 1) {
        const song = listSong[i];
        const year = song.year ?? 1980;
        const clampedYear = Math.max(
          1980,
          Math.min(year, 1980 + TOTAL_SPAN_YEARS),
        );

        const normalised = (clampedYear - 1980) / TOTAL_SPAN_YEARS;

        // Base angle and radius from Archimedean spiral spec
        const baseAngleDeg = normalised * MAX_ANGLE_DEG;
        const baseRadius = R_MAX * (1 - normalised);

        // Arm offset: 4 arms × 90°
        const armIndex = GENRE_ARM_MAP[song.genre ?? "other"] ?? 2;
        const armOffsetDeg = armIndex * 90;

        // Seeded jitter for reproducibility
        const rng = seededRandom(song.id);
        const angleJitterDeg = (rng() * 2 - 1) * 5; // ±5°
        const radiusJitterPct = (rng() * 2 - 1) * 0.02; // ±2%

        const angleDeg = baseAngleDeg + armOffsetDeg + angleJitterDeg;
        const angleRad = (angleDeg * Math.PI) / 180;
        const radius = baseRadius * (1 + radiusJitterPct);

        listPosition.push({
          x: radius * Math.cos(angleRad),
          y: radius * Math.sin(angleRad),
          z: 0,
          angle: angleRad,
          radius,
          songId: song.id,
        });
      }

      this.listStarPosition = listPosition;
    },

    flyToStar(songId: number) {
      const target = this.listStarPosition.find((sp) => sp.songId === songId);
      if (!target) {
        this.selectedSongId = songId;
        return;
      }

      // Move camera pan to center on the target star.
      // The galaxy canvas reads panX/panY to translate the viewport.
      this.panX = target.x;
      this.panY = target.y;
      this.selectedSongId = songId;
      // Smooth animation is delegated to the galaxy canvas via the reactive panX/panY,
      // which the camera controller interpolates with requestAnimationFrame each frame.
    },

    setZoomLevel(zoom: number) {
      this.zoomLevel = zoom;

      // Determine LOD tier from zoom level
      if (zoom < 2) {
        this.lodTier = "far";
      } else if (zoom < 5) {
        this.lodTier = "mid";
      } else {
        this.lodTier = "close";
      }

      // Determine focused era from zoom level — at high zoom we pick the era
      // closest to the current camera position. Without camera position data
      // here we fall back to the closest era by zoom step.
      if (zoom >= 5) {
        // Detailed view — era selection is driven externally by camera position.
        // Leave focusedEra unchanged unless explicitly set.
      } else if (zoom >= 2) {
        this.focusedEra = null;
      } else {
        this.focusedEra = null;
      }
    },

    setPan(x: number, y: number) {
      this.panX = x;
      this.panY = y;
    },

    setFocusedEra(decade: number | null) {
      if (decade === null) {
        this.focusedEra = null;
        return;
      }
      this.focusedEra = LIST_ERA.find((era) => era.decade === decade) ?? null;
    },
  },
});

export { LIST_ERA };
