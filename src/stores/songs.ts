import { defineStore } from "pinia";
import { supabase } from "@/lib/supabase";
import type { ISong } from "@/types";

// Slim select: only fields needed for search, hover, and player.
// Full metadata (images, URLs) loaded on demand via fetchSongDetail().
const SLIM_SELECT = [
  "id",
  "title",
  "title_jp",
  "type",
  "sequence",
  "year",
  "genre",
  "vote_count",
  "animethemes_slug",
  "artist_id",
  "anime_id",
  "artist:artists(id, name)",
  "anime:animes(id, title, season)",
].join(", ");

export const useSongsStore = defineStore("songs", {
  state: () => ({
    listSong: [] as ISong[],
    mapDetail: new Map<number, ISong>(),
    isLoading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchSongs() {
      if (this.listSong.length > 0) {
        return;
      }
      this.isLoading = true;
      this.error = null;

      const PAGE_SIZE = 1000;
      const allSongs: ISong[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from("songs")
          .select(SLIM_SELECT)
          .order("year", { ascending: true })
          .range(from, to);

        if (error) {
          this.error = error.message;
          this.isLoading = false;
          return;
        }

        allSongs.push(...((data as unknown as ISong[]) ?? []));
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        page += 1;
      }

      this.listSong = allSongs;
      this.isLoading = false;
    },

    /**
     * Fetch full song detail (all columns + artist + anime joins).
     * Cached in mapDetail — only fetched once per song.
     */
    async fetchSongDetail(songId: number): Promise<ISong | null> {
      // Return cached detail if available
      if (this.mapDetail.has(songId)) {
        return this.mapDetail.get(songId)!;
      }

      const { data, error } = await supabase
        .from("songs")
        .select("*, artist:artists(*), anime:animes(*)")
        .eq("id", songId)
        .single();

      if (error || !data) {
        return null;
      }

      const song = data as ISong;
      this.mapDetail.set(songId, song);

      // Also update the slim entry in listSong with full data
      const idx = this.listSong.findIndex((s) => s.id === songId);
      if (idx !== -1) {
        this.listSong[idx] = song;
      }

      return song;
    },

    async fetchSongsByEra(decade: number) {
      this.isLoading = true;
      this.error = null;

      const startYear = decade;
      const endYear = decade + 9;

      const { data, error } = await supabase
        .from("songs")
        .select(SLIM_SELECT)
        .gte("year", startYear)
        .lte("year", endYear)
        .order("year", { ascending: true });

      if (error) {
        this.error = error.message;
      } else {
        this.listSong = (data as unknown as ISong[]) ?? [];
      }

      this.isLoading = false;
    },

    searchSongs(query: string): ISong[] {
      const trimmed = query.trim().toLowerCase();
      if (!trimmed) {
        return [];
      }

      const listResult: ISong[] = [];
      for (let i = 0; i < this.listSong.length; i += 1) {
        const song = this.listSong[i];
        const matchTitle = song.title.toLowerCase().includes(trimmed);
        const matchTitleJp =
          song.title_jp?.toLowerCase().includes(trimmed) ?? false;
        const matchArtist =
          song.artist?.name.toLowerCase().includes(trimmed) ?? false;
        const matchAnime =
          song.anime?.title.toLowerCase().includes(trimmed) ?? false;
        if (matchTitle || matchTitleJp || matchArtist || matchAnime) {
          listResult.push(song);
        }
      }

      return listResult;
    },
  },
});
