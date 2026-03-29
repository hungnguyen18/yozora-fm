import { createClient } from "@supabase/supabase-js";
import type { ISeedArtist, ISeedAnime, ISeedSong } from "./types.ts";

// ---------------------------------------------------------------------------
// Supabase client — service role key bypasses RLS
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env["VITE_SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// ---------------------------------------------------------------------------
// Artists
// ---------------------------------------------------------------------------

export const upsertArtists = async (
  artists: ISeedArtist[],
): Promise<Map<string, number>> => {
  console.log(`Upserting ${artists.length} artists...`);

  const artistIdMap = new Map<string, number>();

  // Upsert all artists in batches — updates existing rows on name conflict
  const batches = chunkArray(artists, BATCH_SIZE);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const rows = batch.map((a) => ({
      name: a.name,
      ...(a.nameJp !== undefined ? { name_jp: a.nameJp } : {}),
    }));

    const { data: upserted, error } = await supabase
      .from("artists")
      .upsert(rows, { onConflict: "name" })
      .select("id, name");

    if (error) {
      throw new Error(
        `Failed to upsert artists batch ${i + 1}: ${error.message}`,
      );
    }

    for (let j = 0; j < (upserted ?? []).length; j += 1) {
      const row = upserted![j];
      artistIdMap.set(row.name, row.id);
    }
  }

  console.log(`Artists: upserted ${artistIdMap.size} artists.`);
  return artistIdMap;
};

// ---------------------------------------------------------------------------
// Animes
// ---------------------------------------------------------------------------

export const upsertAnimes = async (
  animes: ISeedAnime[],
  anilistEnrichment: Map<
    number,
    { coverUrl: string; year?: number; season?: string; titleJp?: string }
  >,
): Promise<Map<string, number>> => {
  // Deduplicate by title — keep the last occurrence (most enriched)
  const dedupMap = new Map<string, ISeedAnime>();
  for (let i = 0; i < animes.length; i += 1) {
    dedupMap.set(animes[i].title, animes[i]);
  }
  const listAnimeDeduped = Array.from(dedupMap.values());
  console.log(
    `Upserting ${listAnimeDeduped.length} animes (deduped from ${animes.length})...`,
  );

  const animeIdMap = new Map<string, number>();

  // Upsert all animes in batches — updates existing rows on title conflict
  const batches = chunkArray(listAnimeDeduped, BATCH_SIZE);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const rows = batch.map((anime) => {
      // Merge AniList enrichment if available
      const enriched =
        anime.anilistId !== undefined
          ? anilistEnrichment.get(anime.anilistId)
          : undefined;

      const year = enriched?.year ?? anime.year;
      const rawSeason = enriched?.season ?? anime.season;
      const season = rawSeason?.toLowerCase();
      const coverUrl = enriched?.coverUrl ?? anime.coverUrl;
      const titleJp = enriched?.titleJp ?? anime.titleJp;

      return {
        title: anime.title,
        ...(titleJp !== undefined ? { title_jp: titleJp } : {}),
        ...(year !== undefined ? { year } : {}),
        ...(season !== undefined ? { season } : {}),
        ...(anime.anilistId !== undefined
          ? { anilist_id: anime.anilistId }
          : {}),
        ...(coverUrl !== undefined ? { cover_url: coverUrl } : {}),
      };
    });

    const { data: upserted, error } = await supabase
      .from("animes")
      .upsert(rows, { onConflict: "title" })
      .select("id, title");

    if (error) {
      throw new Error(
        `Failed to upsert animes batch ${i + 1}: ${error.message}`,
      );
    }

    for (let j = 0; j < (upserted ?? []).length; j += 1) {
      const row = upserted![j];
      animeIdMap.set(row.title, row.id);
    }
  }

  console.log(`Animes: upserted ${animeIdMap.size} animes.`);
  return animeIdMap;
};

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------

export const upsertSongs = async (
  songs: ISeedSong[],
  artistIdMap: Map<string, number>,
  animeIdMap: Map<string, number>,
  spotifyEnrichment: Map<string, { spotifyUri: string; albumArtUrl: string }>,
): Promise<void> => {
  console.log(`Upserting ${songs.length} songs...`);

  // Deduplicate by (title, artistName, animeTitle) — keep last occurrence
  const songDedupMap = new Map<string, ISeedSong>();
  for (let i = 0; i < songs.length; i += 1) {
    const s = songs[i];
    songDedupMap.set(`${s.title}|${s.artistName}|${s.animeTitle}`, s);
  }
  const listSongDeduped = Array.from(songDedupMap.values());
  console.log(
    `  Deduped songs: ${listSongDeduped.length} (from ${songs.length})`,
  );

  // Resolve only songs where both FKs can be resolved
  const listResolved: Array<Record<string, unknown>> = [];
  let skipped = 0;

  for (let i = 0; i < listSongDeduped.length; i += 1) {
    const song = listSongDeduped[i];
    const artistId = artistIdMap.get(song.artistName);
    const animeId = animeIdMap.get(song.animeTitle);

    if (artistId === undefined || animeId === undefined) {
      skipped += 1;
      continue;
    }

    const spotifyKey = `${song.artistName}|${song.title}`;
    const spotifyData = spotifyEnrichment.get(spotifyKey);

    listResolved.push({
      title: song.title,
      ...(song.titleJp !== undefined ? { title_jp: song.titleJp } : {}),
      type: song.type,
      sequence: song.sequence,
      year: song.year,
      ...(song.genre !== undefined ? { genre: song.genre } : {}),
      ...(song.animethemesSlug !== undefined
        ? { animethemes_slug: song.animethemesSlug }
        : {}),
      ...(song.youtubeId !== undefined ? { youtube_id: song.youtubeId } : {}),
      artist_id: artistId,
      anime_id: animeId,
      ...(spotifyData !== undefined
        ? {
            spotify_uri: spotifyData.spotifyUri,
            album_art_url: spotifyData.albumArtUrl,
          }
        : {}),
    });
  }

  if (skipped > 0) {
    console.warn(
      `Songs: skipped ${skipped} songs due to unresolved artist/anime FKs.`,
    );
  }

  if (listResolved.length === 0) {
    console.log("Songs: nothing to upsert.");
    return;
  }

  const batches = chunkArray(listResolved, BATCH_SIZE);
  for (let i = 0; i < batches.length; i += 1) {
    const { error } = await supabase
      .from("songs")
      .upsert(batches[i], { onConflict: "title,artist_id,anime_id" });

    if (error) {
      throw new Error(
        `Failed to upsert songs batch ${i + 1}: ${error.message}`,
      );
    }
  }

  console.log(`Songs: upserted ${listResolved.length} songs.`);
};
