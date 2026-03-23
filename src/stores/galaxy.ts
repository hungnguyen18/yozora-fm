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
    // Maps artistId → list of songIds for artists with 2+ songs
    constellationData: new Map<number, number[]>(),
    // Camera trail effect state — set when flyToStar is called during auto-play
    trailStart: null as { x: number; y: number } | null,
    trailEnd: null as { x: number; y: number } | null,
    trailProgress: 0,
    isTrailActive: false,
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

    computeConstellations(listSong: ISong[]) {
      // Group songs by artist_id; only retain artists with 2+ songs
      const grouped = new Map<number, number[]>();

      for (let i = 0; i < listSong.length; i += 1) {
        const song = listSong[i];
        const artistId = song.artist_id;
        if (!grouped.has(artistId)) {
          grouped.set(artistId, []);
        }
        grouped.get(artistId)!.push(song.id);
      }

      const result = new Map<number, number[]>();
      for (const [artistId, listSongId] of grouped.entries()) {
        if (listSongId.length >= 2) {
          result.set(artistId, listSongId);
        }
      }

      this.constellationData = result;
    },

    flyToStar(songId: number) {
      const target = this.listStarPosition.find((sp) => sp.songId === songId);
      if (!target) {
        this.selectedSongId = songId;
        return;
      }

      // Record trail start (current camera pan position) and end (target star)
      // so StarField can brighten stars swept by the camera path.
      this.trailStart = { x: this.panX, y: this.panY };
      this.trailEnd = { x: target.x, y: target.y };
      this.trailProgress = 0;
      this.isTrailActive = true;

      const TRAIL_DURATION_MS = 1500;
      const startTime = performance.now();

      const easeInOutCubic = (t: number): number => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      // Animate camera pan + zoom smoothly
      const startPanX = this.panX;
      const startPanY = this.panY;
      const startZoom = this.zoomLevel;
      const TARGET_ZOOM = Math.max(5, startZoom);

      // Offset the pan target so the star centers in the visible area
      // (viewport minus the 520px detail panel on the right).
      // Camera center must shift RIGHT so the star appears in the LEFT
      // portion of the viewport (the area not covered by the panel).
      // In orthographic projection: world_offset = screen_pixels / zoom.
      const PANEL_WIDTH_PX = 520;
      const panOffsetX = PANEL_WIDTH_PX / 2 / TARGET_ZOOM;
      const targetX = target.x + panOffsetX;
      const targetY = target.y;

      const animateTrail = () => {
        const elapsed = performance.now() - startTime;
        const linearProgress = Math.min(elapsed / TRAIL_DURATION_MS, 1);
        const easedProgress = easeInOutCubic(linearProgress);

        this.trailProgress = easedProgress;

        // Smoothly interpolate camera pan and zoom
        this.panX = startPanX + (targetX - startPanX) * easedProgress;
        this.panY = startPanY + (targetY - startPanY) * easedProgress;

        if (startZoom !== TARGET_ZOOM) {
          const newZoom = startZoom + (TARGET_ZOOM - startZoom) * easedProgress;
          this.setZoomLevel(newZoom);
        }

        if (linearProgress < 1) {
          requestAnimationFrame(animateTrail);
        } else {
          this.panX = targetX;
          this.panY = targetY;
          this.setZoomLevel(TARGET_ZOOM);
          setTimeout(() => {
            this.isTrailActive = false;
            this.trailStart = null;
            this.trailEnd = null;
            this.trailProgress = 0;
          }, 600);
        }
      };

      requestAnimationFrame(animateTrail);

      this.selectedSongId = songId;
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
