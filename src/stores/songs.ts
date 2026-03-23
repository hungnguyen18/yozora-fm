import { defineStore } from 'pinia';
import { supabase } from '@/lib/supabase';
import type { ISong } from '@/types';

export const useSongsStore = defineStore('songs', {
  state: () => ({
    listSong: [] as ISong[],
    isLoading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchSongs() {
      this.isLoading = true;
      this.error = null;

      const { data, error } = await supabase
        .from('songs')
        .select('*, artist:artists(*), anime:animes(*)')
        .order('year', { ascending: true });

      if (error) {
        this.error = error.message;
      } else {
        this.listSong = (data as ISong[]) ?? [];
      }

      this.isLoading = false;
    },

    async fetchSongsByEra(decade: number) {
      this.isLoading = true;
      this.error = null;

      const startYear = decade;
      const endYear = decade + 9;

      const { data, error } = await supabase
        .from('songs')
        .select('*, artist:artists(*), anime:animes(*)')
        .gte('year', startYear)
        .lte('year', endYear)
        .order('year', { ascending: true });

      if (error) {
        this.error = error.message;
      } else {
        this.listSong = (data as ISong[]) ?? [];
      }

      this.isLoading = false;
    },

    async searchSongs(query: string): Promise<ISong[]> {
      const trimmed = query.trim();
      if (!trimmed) {
        return [];
      }

      const { data, error } = await supabase
        .from('songs')
        .select('*, artist:artists(*), anime:animes(*)')
        .or(
          `title.ilike.%${trimmed}%,title_jp.ilike.%${trimmed}%`,
        );

      if (error) {
        return [];
      }

      // Filter by artist name and anime title on the joined data
      const listResult = ((data as ISong[]) ?? []).filter((song) => {
        const lowerQuery = trimmed.toLowerCase();
        const matchTitle = song.title.toLowerCase().includes(lowerQuery);
        const matchTitleJp = song.title_jp?.toLowerCase().includes(lowerQuery) ?? false;
        const matchArtist = song.artist?.name.toLowerCase().includes(lowerQuery) ?? false;
        const matchAnime = song.anime?.title.toLowerCase().includes(lowerQuery) ?? false;
        return matchTitle || matchTitleJp || matchArtist || matchAnime;
      });

      return listResult;
    },
  },
});
