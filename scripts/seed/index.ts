import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Load .env.local before any other imports that read process.env
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ENV_PATH = resolve(__dirname, "../../.env.local");

try {
  const raw = readFileSync(ENV_PATH, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    // Skip comments and empty lines
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
// Pipeline imports (dynamic — must be after env is loaded)
// ---------------------------------------------------------------------------

const { fetchAnimeThemesData } = await import("./animethemes.ts");
const { enrichWithAnilist } = await import("./anilist.ts");
const { enrichWithSpotify } = await import("./spotify.ts");
const { upsertArtists, upsertAnimes, upsertSongs } =
  await import("./upsert.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = (): number => Date.now();

const elapsed = (start: number): string =>
  `${((Date.now() - start) / 1000).toFixed(2)}s`;

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

const run = async (): Promise<void> => {
  const pipelineStart = now();

  // Stage 1 — Fetch from AnimeThemes
  console.log("\n=== Stage 1: AnimeThemes fetch ===");
  const stage1Start = now();
  const { artists, animes, songs, anilistIdMap } = await fetchAnimeThemesData();
  console.log(`Stage 1 done in ${elapsed(stage1Start)}`);

  // Stage 2 — Enrich with AniList (cover art, year, season)
  console.log("\n=== Stage 2: AniList enrichment ===");
  const stage2Start = now();
  let anilistEnrichment: Awaited<ReturnType<typeof enrichWithAnilist>>;
  try {
    anilistEnrichment = await enrichWithAnilist(anilistIdMap);
    console.log(
      `Stage 2 done in ${elapsed(stage2Start)} — ${anilistEnrichment.size} entries`,
    );
  } catch (err) {
    console.warn(
      `Stage 2 failed — continuing without AniList enrichment. Reason: ${(err as Error).message}`,
    );
    anilistEnrichment = new Map();
  }

  // Stage 3 — Enrich with Spotify (optional — skipped if credentials are absent)
  console.log("\n=== Stage 3: Spotify enrichment ===");
  const stage3Start = now();
  let spotifyEnrichment: Awaited<ReturnType<typeof enrichWithSpotify>>;
  try {
    spotifyEnrichment = await enrichWithSpotify(songs);
    console.log(
      `Stage 3 done in ${elapsed(stage3Start)} — ${spotifyEnrichment.size} entries`,
    );
  } catch (err) {
    console.warn(
      `Stage 3 failed — continuing without Spotify enrichment. Reason: ${(err as Error).message}`,
    );
    spotifyEnrichment = new Map();
  }

  // Stage 4 — Upsert to Supabase (order matters: artists → animes → songs)
  console.log("\n=== Stage 4: Supabase upsert ===");
  const stage4Start = now();

  const artistIdMap = await upsertArtists(artists);
  const animeIdMap = await upsertAnimes(animes, anilistEnrichment);
  await upsertSongs(songs, artistIdMap, animeIdMap, spotifyEnrichment);

  console.log(`Stage 4 done in ${elapsed(stage4Start)}`);

  console.log(`\nSeed pipeline complete in ${elapsed(pipelineStart)}`);
};

run().catch((err) => {
  console.error("Seed pipeline failed:", err);
  process.exit(1);
});
