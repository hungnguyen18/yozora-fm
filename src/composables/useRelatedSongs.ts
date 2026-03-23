import { computed } from "vue";
import type { ISong } from "@/types";

export const useRelatedSongs = (
  currentSong: () => ISong | null,
  listSong: () => ISong[],
  maxCount = 5,
) => {
  const listRelated = computed<ISong[]>(() => {
    const song = currentSong();
    if (!song) {
      return [];
    }

    const list = listSong();
    const scored: { song: ISong; score: number }[] = [];

    for (let i = 0; i < list.length; i += 1) {
      const candidate = list[i];
      if (candidate.id === song.id) {
        continue;
      }

      let score = 0;
      if (candidate.artist_id === song.artist_id) {
        score += 5;
      }
      if (candidate.genre === song.genre) {
        score += 3;
      }

      const yearDiff = Math.abs((candidate.year ?? 0) - (song.year ?? 0));
      if (yearDiff <= 2) {
        score += 2;
      } else if (yearDiff <= 5) {
        score += 1;
      }

      if (candidate.animethemes_slug) {
        score += 1;
      }

      if (score > 0) {
        scored.push({ song: candidate, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxCount).map((s) => s.song);
  });

  return { listRelated };
};
