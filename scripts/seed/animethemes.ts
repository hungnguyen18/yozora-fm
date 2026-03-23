import type {
  TAnimeThemesAnime,
  TAnimeThemesListResponse,
  ISeedAnime,
  ISeedArtist,
  ISeedSong,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.animethemes.moe";
const PAGE_SIZE = 100;
// ~700 ms between requests to stay under the 90 req/min rate limit
const REQUEST_DELAY_MS = 700;
// Initial backoff for 429 responses (doubles on each retry)
const INITIAL_BACKOFF_MS = 2000;
const MAX_RETRIES = 5;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (
  url: string,
  retries = MAX_RETRIES,
): Promise<Response> => {
  const response = await fetch(url, {
    headers: { "User-Agent": "Yozora.fm/1.0 (anime music timeline)" },
  });

  if (response.status === 429 && retries > 0) {
    const backoff = INITIAL_BACKOFF_MS * (MAX_RETRIES - retries + 1);
    console.warn(
      `Rate-limited. Retrying in ${backoff}ms... (${retries} retries left)`,
    );
    await sleep(backoff);
    return fetchWithRetry(url, retries - 1);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response;
};

// ---------------------------------------------------------------------------
// Pagination — collect every page of /anime
// ---------------------------------------------------------------------------

const fetchAllAnimePages = async (): Promise<TAnimeThemesAnime[]> => {
  const listAnime: TAnimeThemesAnime[] = [];
  let pageNumber = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const url =
      `${BASE_URL}/anime` +
      `?include=animethemes.song.artists,animethemes.animethemeentries.videos,resources` +
      `&page%5Bsize%5D=${PAGE_SIZE}` +
      `&page%5Bnumber%5D=${pageNumber}`;

    console.log(`Fetching page ${pageNumber}...`);

    const response = await fetchWithRetry(url);
    const body = (await response.json()) as TAnimeThemesListResponse;

    listAnime.push(...body.anime);

    hasNextPage = body.links.next !== null;
    pageNumber += 1;

    // Respect rate limit — skip the delay after the final page
    if (hasNextPage) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return listAnime;
};

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const ANILIST_SITES = new Set(["AniList", "anilist", "Anilist"]);
const YOUTUBE_SITES = new Set(["Youtube", "YouTube", "youtube"]);

const extractAnilistId = (anime: TAnimeThemesAnime): number | undefined => {
  const resource = anime.resources.find((r) => ANILIST_SITES.has(r.site));
  return resource?.external_id ?? undefined;
};

const extractYoutubeId = (anime: TAnimeThemesAnime): string | undefined => {
  const resource = anime.resources.find((r) => YOUTUBE_SITES.has(r.site));
  if (!resource) {
    return undefined;
  }
  // Try to extract video ID from a full YouTube URL, fall back to external_id
  const match = resource.link.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (match) {
    return match[1];
  }
  return resource.external_id != null
    ? String(resource.external_id)
    : undefined;
};

// Map raw API theme type string to our canonical 'OP' | 'ED'
const normalizeThemeType = (rawType: string): "OP" | "ED" | null => {
  const upper = rawType.toUpperCase();
  if (upper === "OP") {
    return "OP";
  }
  if (upper === "ED") {
    return "ED";
  }
  return null;
};

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

const parseAnimeList = (
  listAnime: TAnimeThemesAnime[],
): {
  artists: ISeedArtist[];
  animes: ISeedAnime[];
  songs: ISeedSong[];
  anilistIdMap: Map<string, number>;
} => {
  const listSeedAnime: ISeedAnime[] = [];
  const listSeedSong: ISeedSong[] = [];
  // Deduplicate artists by name
  const artistNameSet = new Set<string>();
  const listSeedArtist: ISeedArtist[] = [];
  const anilistIdMap = new Map<string, number>();

  for (let i = 0; i < listAnime.length; i += 1) {
    const anime = listAnime[i];

    const anilistId = extractAnilistId(anime);
    const animeYear = anime.year ?? undefined;

    const seedAnime: ISeedAnime = {
      title: anime.name,
      year: animeYear,
      season: anime.season ?? undefined,
      anilistId,
    };

    listSeedAnime.push(seedAnime);

    if (anilistId !== undefined) {
      anilistIdMap.set(anime.name, anilistId);
    }

    for (let j = 0; j < anime.animethemes.length; j += 1) {
      const theme = anime.animethemes[j];
      const themeType = normalizeThemeType(theme.type);

      // Skip themes that are neither OP nor ED (e.g. 'IN', 'IS', 'BD', etc.)
      if (themeType === null) {
        continue;
      }

      if (!theme.song || !theme.song.title) {
        continue;
      }

      // Resolve the primary artist credit
      const listArtist = theme.song.artists;
      if (listArtist.length === 0) {
        continue;
      }

      const primaryArtist = listArtist[0];
      // Use the credited alias when available, otherwise the canonical name
      const artistName = primaryArtist.as ?? primaryArtist.name;

      // Collect every credited artist for deduplication
      for (let k = 0; k < listArtist.length; k += 1) {
        const creditName = listArtist[k].as ?? listArtist[k].name;
        if (!artistNameSet.has(creditName)) {
          artistNameSet.add(creditName);
          listSeedArtist.push({ name: creditName });
        }
      }

      // Derive animethemes_slug from the first entry's first video basename
      const firstEntry = theme.animethemeentries[0];
      const firstVideo = firstEntry?.videos[0];
      const animethemesSlug = firstVideo?.basename ?? undefined;

      // Prefer a YouTube resource at the anime level for the song's youtube_id
      const youtubeId = extractYoutubeId(anime);

      const seedSong: ISeedSong = {
        title: theme.song.title,
        type: themeType,
        sequence: theme.sequence ?? 1,
        year: animeYear ?? new Date().getFullYear(),
        animethemesSlug,
        youtubeId,
        artistName,
        animeTitle: anime.name,
      };

      listSeedSong.push(seedSong);
    }
  }

  return {
    artists: listSeedArtist,
    animes: listSeedAnime,
    songs: listSeedSong,
    anilistIdMap,
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const fetchAnimeThemesData = async (): Promise<{
  artists: ISeedArtist[];
  animes: ISeedAnime[];
  songs: ISeedSong[];
  anilistIdMap: Map<string, number>;
}> => {
  const listAnime = await fetchAllAnimePages();
  const result = parseAnimeList(listAnime);

  console.log(
    `Parsed ${result.animes.length} anime, ${result.songs.length} songs, ${result.artists.length} unique artists`,
  );

  return result;
};

// ---------------------------------------------------------------------------
// Direct execution entry point
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAnimeThemesData().then((data) => {
    console.log(
      `Artists: ${data.artists.length}, Animes: ${data.animes.length}, Songs: ${data.songs.length}`,
    );
  });
}
