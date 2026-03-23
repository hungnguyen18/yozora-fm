import { createClient } from '@supabase/supabase-js';
import type { ISeedArtist, ISeedAnime, ISeedSong } from './types.ts';

// ---------------------------------------------------------------------------
// Supabase client — service role key bypasses RLS
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env['VITE_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
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

  // Fetch all existing artists by name to avoid duplicates
  const listName = artists.map((a) => a.name);
  const { data: existing, error: fetchError } = await supabase
    .from('artists')
    .select('id, name')
    .in('name', listName);

  if (fetchError) {
    throw new Error(`Failed to fetch existing artists: ${fetchError.message}`);
  }

  // Populate map with already-existing artists
  for (let i = 0; i < (existing ?? []).length; i += 1) {
    const row = existing![i];
    artistIdMap.set(row.name, row.id);
  }

  // Determine which artists are truly new
  const listNew = artists.filter((a) => !artistIdMap.has(a.name));

  if (listNew.length === 0) {
    console.log(`Artists: all ${artists.length} already exist.`);
    return artistIdMap;
  }

  // Insert new artists in batches
  const batches = chunkArray(listNew, BATCH_SIZE);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const rows = batch.map((a) => ({
      name: a.name,
      ...(a.nameJp !== undefined ? { name_jp: a.nameJp } : {}),
    }));

    const { data: inserted, error } = await supabase
      .from('artists')
      .insert(rows)
      .select('id, name');

    if (error) {
      throw new Error(`Failed to insert artists batch ${i + 1}: ${error.message}`);
    }

    for (let j = 0; j < (inserted ?? []).length; j += 1) {
      const row = inserted![j];
      artistIdMap.set(row.name, row.id);
    }
  }

  console.log(`Artists: inserted ${listNew.length} new, ${existing?.length ?? 0} already existed.`);
  return artistIdMap;
};

// ---------------------------------------------------------------------------
// Animes
// ---------------------------------------------------------------------------

export const upsertAnimes = async (
  animes: ISeedAnime[],
  anilistEnrichment: Map<number, { coverUrl: string; year?: number; season?: string }>,
): Promise<Map<string, number>> => {
  console.log(`Upserting ${animes.length} animes...`);

  const animeIdMap = new Map<string, number>();

  const listTitle = animes.map((a) => a.title);
  const { data: existing, error: fetchError } = await supabase
    .from('animes')
    .select('id, title')
    .in('title', listTitle);

  if (fetchError) {
    throw new Error(`Failed to fetch existing animes: ${fetchError.message}`);
  }

  for (let i = 0; i < (existing ?? []).length; i += 1) {
    const row = existing![i];
    animeIdMap.set(row.title, row.id);
  }

  const listNew = animes.filter((a) => !animeIdMap.has(a.title));

  if (listNew.length === 0) {
    console.log(`Animes: all ${animes.length} already exist.`);
    return animeIdMap;
  }

  const batches = chunkArray(listNew, BATCH_SIZE);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const rows = batch.map((anime) => {
      // Merge AniList enrichment if available
      const enriched =
        anime.anilistId !== undefined ? anilistEnrichment.get(anime.anilistId) : undefined;

      const year = enriched?.year ?? anime.year;
      const season = enriched?.season ?? anime.season;
      const coverUrl = enriched?.coverUrl ?? anime.coverUrl;

      return {
        title: anime.title,
        ...(anime.titleJp !== undefined ? { title_jp: anime.titleJp } : {}),
        ...(year !== undefined ? { year } : {}),
        ...(season !== undefined ? { season } : {}),
        ...(anime.anilistId !== undefined ? { anilist_id: anime.anilistId } : {}),
        ...(coverUrl !== undefined ? { cover_url: coverUrl } : {}),
      };
    });

    const { data: inserted, error } = await supabase
      .from('animes')
      .insert(rows)
      .select('id, title');

    if (error) {
      throw new Error(`Failed to insert animes batch ${i + 1}: ${error.message}`);
    }

    for (let j = 0; j < (inserted ?? []).length; j += 1) {
      const row = inserted![j];
      animeIdMap.set(row.title, row.id);
    }
  }

  console.log(`Animes: inserted ${listNew.length} new, ${existing?.length ?? 0} already existed.`);
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

  // Resolve only songs where both FKs can be resolved
  const listResolved: Array<Record<string, unknown>> = [];
  let skipped = 0;

  for (let i = 0; i < songs.length; i += 1) {
    const song = songs[i];
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
      ...(song.animethemesSlug !== undefined ? { animethemes_slug: song.animethemesSlug } : {}),
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
    console.warn(`Songs: skipped ${skipped} songs due to unresolved artist/anime FKs.`);
  }

  if (listResolved.length === 0) {
    console.log('Songs: nothing to insert.');
    return;
  }

  const batches = chunkArray(listResolved, BATCH_SIZE);
  for (let i = 0; i < batches.length; i += 1) {
    const { error } = await supabase.from('songs').insert(batches[i]);

    if (error) {
      throw new Error(`Failed to insert songs batch ${i + 1}: ${error.message}`);
    }
  }

  console.log(`Songs: inserted ${listResolved.length} songs.`);
};
