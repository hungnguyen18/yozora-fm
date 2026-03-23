import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const BATCH_SIZE = 50;
// ~700 ms between requests to stay under the 90 req/min rate limit
const REQUEST_DELAY_MS = 700;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CACHE_PATH = `${__dirname}/.cache/anilist.json`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TAnilistSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

interface TAnilistMedia {
  id: number;
  coverImage: { large: string } | null;
  seasonYear: number | null;
  season: TAnilistSeason | null;
}

interface TAnilistPageResponse {
  data: {
    Page: {
      media: TAnilistMedia[];
    };
  };
}

type TAnilistEnrichment = {
  coverUrl: string;
  year?: number;
  season?: string;
};

// Serializable cache format (Map cannot be JSON-serialised directly)
type TCacheEntry = [number, TAnilistEnrichment];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const mapSeason = (season: TAnilistSeason | null): string | undefined => {
  if (season === null) {
    return undefined;
  }

  const seasonMap: Record<TAnilistSeason, string> = {
    WINTER: 'winter',
    SPRING: 'spring',
    SUMMER: 'summer',
    FALL: 'fall',
  };

  return seasonMap[season];
};

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// ---------------------------------------------------------------------------
// GraphQL query
// ---------------------------------------------------------------------------

const MEDIA_QUERY = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        coverImage { large }
        seasonYear
        season
      }
    }
  }
`;

const fetchBatch = async (
  ids: number[],
): Promise<TAnilistMedia[]> => {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query: MEDIA_QUERY, variables: { ids } }),
  });

  if (!response.ok) {
    throw new Error(`AniList responded with status ${response.status}`);
  }

  const json = (await response.json()) as TAnilistPageResponse;
  return json.data.Page.media;
};

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const loadCache = (): Map<number, TAnilistEnrichment> | null => {
  if (!existsSync(CACHE_PATH)) {
    return null;
  }

  const raw = readFileSync(CACHE_PATH, 'utf-8');
  const entries = JSON.parse(raw) as TCacheEntry[];
  return new Map(entries);
};

const saveCache = (data: Map<number, TAnilistEnrichment>): void => {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  const entries: TCacheEntry[] = Array.from(data.entries());
  writeFileSync(CACHE_PATH, JSON.stringify(entries, null, 2), 'utf-8');
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const enrichWithAnilist = async (
  anilistIdMap: Map<string, number>,
): Promise<Map<number, TAnilistEnrichment>> => {
  const cached = loadCache();
  if (cached !== null) {
    console.log(`AniList: loaded ${cached.size} entries from cache.`);
    return cached;
  }

  const allIds = Array.from(new Set(anilistIdMap.values()));
  const batches = chunkArray(allIds, BATCH_SIZE);
  const result = new Map<number, TAnilistEnrichment>();

  for (let i = 0; i < batches.length; i += 1) {
    console.log(`Enriching batch ${i + 1}/${batches.length} from AniList...`);

    try {
      const mediaList = await fetchBatch(batches[i]);

      for (let j = 0; j < mediaList.length; j += 1) {
        const media = mediaList[j];
        const coverUrl = media.coverImage?.large ?? '';

        // Skip entries with no cover image — they are not useful for the seed
        if (!coverUrl) {
          continue;
        }

        const enrichment: TAnilistEnrichment = {
          coverUrl,
          year: media.seasonYear ?? undefined,
          season: mapSeason(media.season),
        };

        result.set(media.id, enrichment);
      }
    } catch (error) {
      console.warn(
        `AniList: batch ${i + 1}/${batches.length} failed — skipping. Reason: ${(error as Error).message}`,
      );
    }

    // Delay between requests to respect rate limit (skip after last batch)
    if (i < batches.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  saveCache(result);
  console.log(`AniList: fetched ${result.size} entries, cache saved to ${CACHE_PATH}`);

  return result;
};
