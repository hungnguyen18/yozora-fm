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
    // Constellation focus mode — keeps lines visible and dims other stars
    focusedArtistId: null as number | null,
    // Camera trail effect state — set when flyToStar is called during auto-play
    trailStart: null as { x: number; y: number } | null,
    trailEnd: null as { x: number; y: number } | null,
    trailProgress: 0,
    isTrailActive: false,
  }),
  getters: {
    currentEra: (state): IEra | null => state.focusedEra,
  },
  actions: {
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
      // Clear constellation focus when navigating to a specific star
      this.focusedArtistId = null;

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
      // Zoom closer for stars near the center (small radius = newer era)
      const starRadius = Math.sqrt(target.x * target.x + target.y * target.y);
      const baseTargetZoom = starRadius < 100 ? 12 : starRadius < 250 ? 8 : 5;
      const TARGET_ZOOM = Math.max(baseTargetZoom, startZoom);

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

    focusArtist(artistId: number | null) {
      this.focusedArtistId = artistId;
      if (artistId === null) {
        return;
      }

      const listSongId = this.constellationData.get(artistId);
      if (!listSongId || listSongId.length < 2) {
        return;
      }

      // Compute bounding box of all artist's star positions
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (let i = 0; i < this.listStarPosition.length; i += 1) {
        const sp = this.listStarPosition[i];
        if (!listSongId.includes(sp.songId)) {
          continue;
        }
        if (sp.x < minX) {
          minX = sp.x;
        }
        if (sp.x > maxX) {
          maxX = sp.x;
        }
        if (sp.y < minY) {
          minY = sp.y;
        }
        if (sp.y > maxY) {
          maxY = sp.y;
        }
      }

      // Fly camera to center of bounding box with zoom to frame all stars
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const spanX = maxX - minX;
      const spanY = maxY - minY;
      const span = Math.max(spanX, spanY, 20);

      // Calculate zoom to fit the span in ~60% of usable viewport
      // Subtract 520px for the detail panel that may be open on the right
      const PANEL_WIDTH = 520;
      const usableWidth = window.innerWidth - PANEL_WIDTH;
      const viewportSize = Math.min(usableWidth, window.innerHeight);
      const targetZoom = (viewportSize * 0.6) / span;
      const clampedZoom = Math.max(2, Math.min(targetZoom, 15));

      this.setPan(centerX, centerY);
      this.setZoomLevel(clampedZoom);
    },

    flyToEra(decade: number) {
      // Calculate ring radius for this decade
      const R_MAX = 500;
      const TOTAL_SPAN_YEARS = 46;
      const radius = R_MAX * (1 - (decade - 1980) / TOTAL_SPAN_YEARS);

      // Pan to galaxy center and zoom to frame the ring
      // Ring should fill ~60% of the smaller viewport dimension
      const PANEL_WIDTH = 520;
      const viewportSize = Math.min(
        window.innerWidth - PANEL_WIDTH,
        window.innerHeight,
      );
      const targetZoom = (viewportSize * 0.3) / radius;
      const clampedZoom = Math.max(1, Math.min(targetZoom, 8));

      this.setPan(0, 0);
      this.setZoomLevel(clampedZoom);
      // Set focusedEra AFTER setZoomLevel, since setZoomLevel clears it at low zoom
      this.setFocusedEra(decade);
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
