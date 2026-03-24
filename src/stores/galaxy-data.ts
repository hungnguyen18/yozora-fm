import { defineStore } from "pinia";
import type { TGenre, TSongType } from "@/types";

/**
 * Lightweight star data for galaxy rendering.
 * Loaded from a static JSON file (CDN-cached), zero Supabase queries.
 */
export interface IGalaxyStarData {
  id: number;
  year: number;
  genre: TGenre;
  type: TSongType;
  voteCount: number;
  artistId: number;
}

// Must match scripts/build-galaxy-data.ts GENRE_INDEX
const LIST_GENRE: TGenre[] = [
  "rock",
  "ballad",
  "electronic",
  "pop",
  "orchestral",
  "other",
];

export const useGalaxyDataStore = defineStore("galaxyData", {
  state: () => ({
    listStar: [] as IGalaxyStarData[],
    mapStarById: new Map<number, IGalaxyStarData>(),
    mapIdToIndex: new Map<number, number>(),
    isLoading: true,
  }),

  actions: {
    async fetchGalaxyData() {
      this.isLoading = true;

      try {
        const res = await fetch("/galaxy-data.json");
        const compact: Array<[number, number, number, number, number, number]> =
          await res.json();

        const list: IGalaxyStarData[] = new Array(compact.length);
        const map = new Map<number, IGalaxyStarData>();
        const indexMap = new Map<number, number>();

        for (let i = 0; i < compact.length; i += 1) {
          const [id, year, genreIdx, typeIdx, voteCount, artistId] = compact[i];
          const star: IGalaxyStarData = {
            id,
            year,
            genre: LIST_GENRE[genreIdx] ?? "other",
            type: typeIdx === 0 ? "OP" : "ED",
            voteCount,
            artistId,
          };
          list[i] = star;
          map.set(id, star);
          indexMap.set(id, i);
        }

        this.listStar = list;
        this.mapStarById = map;
        this.mapIdToIndex = indexMap;
      } catch (err) {
        console.error("[galaxyData] Failed to load galaxy-data.json:", err);
      }

      this.isLoading = false;
    },
  },
});
