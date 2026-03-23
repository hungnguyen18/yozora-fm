import { defineStore } from "pinia";
import { supabase } from "@/lib/supabase";
import type { ISong } from "@/types";

export const useSongsStore = defineStore("songs", {
  state: () => ({
    listSong: [] as ISong[],
    isLoading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchSongs() {
      this.isLoading = true;
      this.error = null;

      // Supabase returns max 1000 rows per query — paginate to get all
      const PAGE_SIZE = 1000;
      const allSongs: ISong[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from("songs")
          .select("*, artist:artists(*), anime:animes(*)")
          .order("year", { ascending: true })
          .range(from, to);

        if (error) {
          this.error = error.message;
          this.isLoading = false;
          return;
        }

        allSongs.push(...((data as ISong[]) ?? []));
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        page += 1;
      }

      this.listSong = allSongs;
      this.isLoading = false;
    },

    async fetchSongsByEra(decade: number) {
      this.isLoading = true;
      this.error = null;

      const startYear = decade;
      const endYear = decade + 9;

      const { data, error } = await supabase
        .from("songs")
        .select("*, artist:artists(*), anime:animes(*)")
        .gte("year", startYear)
        .lte("year", endYear)
        .order("year", { ascending: true });

      if (error) {
        this.error = error.message;
      } else {
        this.listSong = (data as ISong[]) ?? [];
      }

      this.isLoading = false;
    },

    searchSongs(query: string): ISong[] {
      const trimmed = query.trim().toLowerCase();
      if (!trimmed) {
        return [];
      }

      // Search the already-loaded song list (avoids DB round-trip and
      // fixes the bug where artist/anime-only matches were never returned
      // because the old Supabase .or() only filtered on title columns).
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
