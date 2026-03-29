import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Load .env.local before anything else
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ENV_PATH = resolve(__dirname, "../.env.local");

try {
  const raw = readFileSync(ENV_PATH, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
  console.log(`Loaded env from ${ENV_PATH}`);
} catch {
  console.warn(
    `.env.local not found at ${ENV_PATH} — relying on existing process.env`,
  );
}

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

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const ANILIST_BATCH_SIZE = 50;
const REQUEST_DELAY_MS = 700;
const FETCH_BATCH_SIZE = 1000;
const UPDATE_BATCH_SIZE = 500;

const CACHE_DIR = resolve(__dirname, "seed/.cache");
const CACHE_PATH = resolve(CACHE_DIR, "anilist-genres.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TGenre =
  | "rock"
  | "metal"
  | "punk"
  | "electronic"
  | "hip-hop"
  | "jazz"
  | "pop"
  | "idol"
  | "r-and-b"
  | "reggae"
  | "ballad"
  | "folk"
  | "orchestral"
  | "other";

interface ISongRow {
  id: number;
  type: "OP" | "ED";
  anime_id: number;
  artist_id: number;
}

interface IAnimeRow {
  id: number;
  anilist_id: number | null;
}

interface IArtistRow {
  id: number;
  name: string;
}

interface IAnilistTag {
  name: string;
  rank: number;
}

interface IAnilistMedia {
  id: number;
  genres: string[];
  tags: IAnilistTag[];
}

interface IAnilistPageResponse {
  data: {
    Page: {
      media: IAnilistMedia[];
    };
  };
}

interface IAnilistGenreData {
  genres: string[];
  tags: string[];
}

type TCacheEntry = [number, IAnilistGenreData];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// ---------------------------------------------------------------------------
// AniList GraphQL
// ---------------------------------------------------------------------------

const GENRE_TAG_QUERY = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        genres
        tags { name rank }
      }
    }
  }
`;

const fetchAnilistBatch = async (ids: number[]): Promise<IAnilistMedia[]> => {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: GENRE_TAG_QUERY, variables: { ids } }),
  });

  if (response.status === 429) {
    console.warn("  Rate limited — waiting 60s...");
    await sleep(60_000);
    return fetchAnilistBatch(ids);
  }

  if (!response.ok) {
    throw new Error(`AniList responded with status ${response.status}`);
  }

  const json = (await response.json()) as IAnilistPageResponse;
  return json.data.Page.media;
};

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const loadCache = (): Map<number, IAnilistGenreData> | null => {
  if (!existsSync(CACHE_PATH)) {
    return null;
  }

  const raw = readFileSync(CACHE_PATH, "utf-8");
  const entries = JSON.parse(raw) as TCacheEntry[];
  return new Map(entries);
};

const saveCache = (data: Map<number, IAnilistGenreData>): void => {
  mkdirSync(CACHE_DIR, { recursive: true });
  const entries: TCacheEntry[] = Array.from(data.entries());
  writeFileSync(CACHE_PATH, JSON.stringify(entries, null, 2), "utf-8");
};

// ---------------------------------------------------------------------------
// Fetch AniList genre/tag data for all anilist IDs
// ---------------------------------------------------------------------------

const fetchAnilistGenreData = async (
  listAnilistId: number[],
): Promise<Map<number, IAnilistGenreData>> => {
  const cached = loadCache();
  if (cached !== null) {
    console.log(`AniList genres: loaded ${cached.size} entries from cache.`);
    return cached;
  }

  const batches = chunkArray(listAnilistId, ANILIST_BATCH_SIZE);
  const result = new Map<number, IAnilistGenreData>();

  for (let i = 0; i < batches.length; i += 1) {
    console.log(`  Fetching AniList batch ${i + 1}/${batches.length}...`);

    try {
      const mediaList = await fetchAnilistBatch(batches[i]);

      for (let j = 0; j < mediaList.length; j += 1) {
        const media = mediaList[j];
        // Only include tags with rank >= 50 (relevant enough)
        const listTag: string[] = [];
        for (let k = 0; k < media.tags.length; k += 1) {
          if (media.tags[k].rank >= 50) {
            listTag.push(media.tags[k].name);
          }
        }

        result.set(media.id, {
          genres: media.genres,
          tags: listTag,
        });
      }
    } catch (error) {
      console.warn(
        `  AniList batch ${i + 1}/${batches.length} failed — skipping. Reason: ${(error as Error).message}`,
      );
    }

    // Delay between requests to respect rate limit (skip after last batch)
    if (i < batches.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  saveCache(result);
  console.log(`AniList genres: fetched ${result.size} entries, cache saved.`);

  return result;
};

// ---------------------------------------------------------------------------
// Genre classification
// ---------------------------------------------------------------------------

const LIST_ALL_GENRE: TGenre[] = [
  "rock",
  "metal",
  "punk",
  "electronic",
  "hip-hop",
  "jazz",
  "pop",
  "idol",
  "r-and-b",
  "reggae",
  "ballad",
  "folk",
  "orchestral",
  "other",
];

const makeScores = (): Record<TGenre, number> => ({
  rock: 0,
  metal: 0,
  punk: 0,
  electronic: 0,
  "hip-hop": 0,
  jazz: 0,
  pop: 0,
  idol: 0,
  "r-and-b": 0,
  reggae: 0,
  ballad: 0,
  folk: 0,
  orchestral: 0,
  other: 0,
});

const classifyGenre = (
  anilistGenres: string[],
  anilistTags: string[],
  artistName: string,
  songType: "OP" | "ED",
): TGenre => {
  const scores = makeScores();

  // -------------------------------------------------------------------------
  // Signal 1: AniList tags (strongest signal)
  // -------------------------------------------------------------------------
  const listTagLower = anilistTags.map((t) => t.toLowerCase());

  if (
    listTagLower.some((t) => ["metal", "heavy metal", "visual kei"].includes(t))
  ) {
    scores.metal += 5;
  }
  if (listTagLower.some((t) => ["punk"].includes(t))) {
    scores.punk += 5;
  }
  if (listTagLower.some((t) => ["band", "rock"].includes(t))) {
    scores.rock += 5;
  }
  if (
    listTagLower.some((t) =>
      ["idol", "idols", "idol group", "female idol", "male idol"].includes(t),
    )
  ) {
    scores.idol += 5;
  }
  if (
    listTagLower.some((t) =>
      ["orchestra", "classical music", "musical"].includes(t),
    )
  ) {
    scores.orchestral += 5;
  }
  if (
    listTagLower.some((t) =>
      [
        "cyberpunk",
        "virtual reality",
        "artificial intelligence",
        "robots",
      ].includes(t),
    )
  ) {
    scores.electronic += 3;
  }
  if (listTagLower.some((t) => ["hip-hop", "rap", "hip hop"].includes(t))) {
    scores["hip-hop"] += 5;
  }
  if (listTagLower.some((t) => ["jazz"].includes(t))) {
    scores.jazz += 5;
  }
  if (
    listTagLower.some((t) => ["folk", "traditional", "historical"].includes(t))
  ) {
    scores.folk += 4;
  }
  if (listTagLower.some((t) => ["r&b", "soul", "funk"].includes(t))) {
    scores["r-and-b"] += 5;
  }
  if (listTagLower.some((t) => ["reggae", "ska", "latin"].includes(t))) {
    scores.reggae += 5;
  }
  if (
    listTagLower.some((t) =>
      ["tokusatsu", "super robot", "real robot"].includes(t),
    )
  ) {
    scores.rock += 3;
    scores.electronic += 1;
  }
  if (listTagLower.some((t) => ["war", "military"].includes(t))) {
    scores.orchestral += 2;
  }
  if (
    listTagLower.some((t) =>
      ["primarily female cast", "cute girls doing cute things"].includes(t),
    )
  ) {
    scores.pop += 2;
  }

  // -------------------------------------------------------------------------
  // Signal 2: AniList genres (broader, weaker signal)
  // -------------------------------------------------------------------------
  const listGenreLower = anilistGenres.map((g) => g.toLowerCase());

  if (listGenreLower.includes("action") || listGenreLower.includes("sports")) {
    scores.rock += 2;
  }
  if (listGenreLower.includes("romance") || listGenreLower.includes("drama")) {
    scores.ballad += 2;
  }
  if (listGenreLower.includes("sci-fi")) {
    scores.electronic += 2;
  }
  if (listGenreLower.includes("slice of life")) {
    scores.pop += 2;
  }
  if (
    listGenreLower.includes("fantasy") ||
    listGenreLower.includes("adventure")
  ) {
    scores.orchestral += 1;
  }
  if (listGenreLower.includes("music")) {
    scores.pop += 1;
  }
  if (
    listGenreLower.includes("horror") ||
    listGenreLower.includes("thriller")
  ) {
    scores.rock += 1;
    scores.metal += 1;
  }
  if (listGenreLower.includes("mecha")) {
    scores.electronic += 2;
    scores.rock += 1;
  }
  if (listGenreLower.includes("comedy")) {
    scores.pop += 1;
  }
  if (listGenreLower.includes("supernatural")) {
    scores.rock += 1;
  }

  // -------------------------------------------------------------------------
  // Signal 3: Artist name patterns
  // -------------------------------------------------------------------------
  const artistLower = artistName.toLowerCase();

  if (/\bmetal\b/.test(artistLower) || /\bvisual\s?kei\b/.test(artistLower)) {
    scores.metal += 4;
  }
  if (/\bpunk\b/.test(artistLower)) {
    scores.punk += 4;
  }
  if (/\bband\b/.test(artistLower) || /\brock\b/.test(artistLower)) {
    scores.rock += 3;
  }
  if (
    /\bdj\b/.test(artistLower) ||
    /\belectr/.test(artistLower) ||
    /\btrance\b/.test(artistLower) ||
    /\bedm\b/.test(artistLower)
  ) {
    scores.electronic += 3;
  }
  if (
    /\bhip[\s-]?hop\b/.test(artistLower) ||
    /\brap\b/.test(artistLower) ||
    /\bmc\s/.test(artistLower)
  ) {
    scores["hip-hop"] += 4;
  }
  if (
    /\bjazz\b/.test(artistLower) ||
    /\bfusion\b/.test(artistLower) ||
    /\bswing\b/.test(artistLower)
  ) {
    scores.jazz += 4;
  }
  if (
    /\borchestra\b/.test(artistLower) ||
    /\bphilharmonic\b/.test(artistLower) ||
    /\bensemble\b/.test(artistLower)
  ) {
    scores.orchestral += 4;
  }
  if (/\bfolk\b/.test(artistLower) || /\bacoustic\b/.test(artistLower)) {
    scores.folk += 3;
  }
  if (
    /\br&b\b/.test(artistLower) ||
    /\bsoul\b/.test(artistLower) ||
    /\bfunk\b/.test(artistLower)
  ) {
    scores["r-and-b"] += 4;
  }
  if (/\breggae\b/.test(artistLower) || /\blatin\b/.test(artistLower)) {
    scores.reggae += 4;
  }
  if (/\bidol\b/.test(artistLower)) {
    scores.idol += 3;
  }

  // -------------------------------------------------------------------------
  // Signal 4: Song type bias — EDs tend to be ballads
  // -------------------------------------------------------------------------
  if (songType === "ED") {
    scores.ballad += 1;
  }

  // -------------------------------------------------------------------------
  // Pick the highest score
  // -------------------------------------------------------------------------
  let best: TGenre = "pop";
  let bestScore = 0;

  for (let i = 0; i < LIST_ALL_GENRE.length; i += 1) {
    const genre = LIST_ALL_GENRE[i];
    if (scores[genre] > bestScore) {
      bestScore = scores[genre];
      best = genre;
    }
  }

  return bestScore > 0 ? best : "other";
};

// ---------------------------------------------------------------------------
// Fetch songs — all songs when --force, otherwise only genre IS NULL
// ---------------------------------------------------------------------------

const FORCE_MODE = process.argv.includes("--force");

const fetchSongs = async (): Promise<ISongRow[]> => {
  const listSong: ISongRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("songs")
      .select("id, type, anime_id, artist_id")
      .range(from, from + FETCH_BATCH_SIZE - 1);

    if (!FORCE_MODE) {
      query = query.is("genre", null);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch songs: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (let i = 0; i < data.length; i += 1) {
      listSong.push(data[i] as ISongRow);
    }

    if (data.length < FETCH_BATCH_SIZE) {
      break;
    }

    from += FETCH_BATCH_SIZE;
  }

  return listSong;
};

// ---------------------------------------------------------------------------
// Fetch all animes (id, anilist_id)
// ---------------------------------------------------------------------------

const fetchAnimes = async (): Promise<Map<number, IAnimeRow>> => {
  const animeMap = new Map<number, IAnimeRow>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("animes")
      .select("id, anilist_id")
      .range(from, from + FETCH_BATCH_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch animes: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (let i = 0; i < data.length; i += 1) {
      const row = data[i] as IAnimeRow;
      animeMap.set(row.id, row);
    }

    if (data.length < FETCH_BATCH_SIZE) {
      break;
    }

    from += FETCH_BATCH_SIZE;
  }

  return animeMap;
};

// ---------------------------------------------------------------------------
// Fetch all artists (id, name)
// ---------------------------------------------------------------------------

const fetchArtists = async (): Promise<Map<number, IArtistRow>> => {
  const artistMap = new Map<number, IArtistRow>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("artists")
      .select("id, name")
      .range(from, from + FETCH_BATCH_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch artists: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (let i = 0; i < data.length; i += 1) {
      const row = data[i] as IArtistRow;
      artistMap.set(row.id, row);
    }

    if (data.length < FETCH_BATCH_SIZE) {
      break;
    }

    from += FETCH_BATCH_SIZE;
  }

  return artistMap;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const run = async (): Promise<void> => {
  const startTime = Date.now();

  // Step 1: Fetch songs
  if (FORCE_MODE) {
    console.log("FORCE MODE — re-classifying ALL songs...");
  } else {
    console.log("Fetching songs without genre...");
  }
  const listSong = await fetchSongs();
  console.log(`Found ${listSong.length} songs to classify.\n`);

  if (listSong.length === 0) {
    console.log("Nothing to do — all songs already have a genre.");
    return;
  }

  // Step 2: Fetch anime and artist lookup tables
  console.log("Fetching animes and artists...");
  const animeMap = await fetchAnimes();
  const artistMap = await fetchArtists();
  console.log(`Loaded ${animeMap.size} animes, ${artistMap.size} artists.\n`);

  // Step 3: Collect unique anilist IDs that need genre data
  const setAnilistId = new Set<number>();
  for (let i = 0; i < listSong.length; i += 1) {
    const anime = animeMap.get(listSong[i].anime_id);
    if (anime !== undefined && anime.anilist_id !== null) {
      setAnilistId.add(anime.anilist_id);
    }
  }

  const listAnilistId = Array.from(setAnilistId);
  console.log(
    `Need AniList genre data for ${listAnilistId.length} unique anime IDs.`,
  );

  // Step 4: Fetch AniList genre/tag data
  const anilistGenreMap = await fetchAnilistGenreData(listAnilistId);
  console.log("");

  // Step 5: Classify each song
  console.log("Classifying genres...");
  const listUpdate: Array<{ id: number; genre: TGenre }> = [];
  const distribution = makeScores();

  for (let i = 0; i < listSong.length; i += 1) {
    const song = listSong[i];
    const anime = animeMap.get(song.anime_id);
    const artist = artistMap.get(song.artist_id);

    // Look up AniList data via anime's anilist_id
    let anilistGenres: string[] = [];
    let anilistTags: string[] = [];

    if (anime !== undefined && anime.anilist_id !== null) {
      const anilistData = anilistGenreMap.get(anime.anilist_id);
      if (anilistData !== undefined) {
        anilistGenres = anilistData.genres;
        anilistTags = anilistData.tags;
      }
    }

    const artistName = artist !== undefined ? artist.name : "";
    const genre = classifyGenre(
      anilistGenres,
      anilistTags,
      artistName,
      song.type,
    );

    listUpdate.push({ id: song.id, genre });
    distribution[genre] += 1;
  }

  console.log("Genre distribution:");
  for (let i = 0; i < LIST_ALL_GENRE.length; i += 1) {
    const genre = LIST_ALL_GENRE[i];
    const count = distribution[genre];
    const pct = ((count / listSong.length) * 100).toFixed(1);
    console.log(
      `  ${genre.padEnd(12)} ${String(count).padStart(5)}  (${pct}%)`,
    );
  }
  console.log("");

  // Step 6: Batch-update songs in Supabase
  console.log("Updating songs in Supabase...");
  const batches = chunkArray(listUpdate, UPDATE_BATCH_SIZE);
  let countUpdated = 0;
  let countFailed = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    console.log(
      `  Batch ${i + 1}/${batches.length} (${batch.length} songs)...`,
    );

    // Supabase doesn't support batch-update-by-id natively, so we group by genre
    // and update all songs with the same genre in one call
    const genreGroups = new Map<TGenre, number[]>();

    for (let j = 0; j < batch.length; j += 1) {
      const item = batch[j];
      const existing = genreGroups.get(item.genre);
      if (existing !== undefined) {
        existing.push(item.id);
      } else {
        genreGroups.set(item.genre, [item.id]);
      }
    }

    for (const [genre, listId] of genreGroups) {
      const { error } = await supabase
        .from("songs")
        .update({ genre })
        .in("id", listId);

      if (error) {
        countFailed += listId.length;
        console.warn(
          `    Failed to update ${listId.length} songs as "${genre}": ${error.message}`,
        );
      } else {
        countUpdated += listId.length;
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n=== Genre enrichment complete ===");
  console.log(`Updated: ${countUpdated}`);
  console.log(`Failed:  ${countFailed}`);
  console.log(`Time:    ${elapsed}s`);
};

run().catch((err) => {
  console.error("Genre enrichment failed:", err);
  process.exit(1);
});
