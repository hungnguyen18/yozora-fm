/**
 * build-galaxy-data.ts — Generate compact galaxy rendering data as static JSON.
 *
 * Produces public/galaxy-data.json: an array of tuples [id, year, genreIndex, typeIndex, voteCount].
 * This file is CDN-cached and fetched on app mount for instant galaxy rendering
 * without any Supabase queries.
 *
 * Usage: yarn build:galaxy
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local ──
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
} catch {
  console.warn(`.env.local not found — relying on existing process.env`);
}

// ── Supabase client ──
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!,
);

// ── Genre/type index mapping (must match src/stores/galaxy-data.ts) ──
const GENRE_INDEX: Record<string, number> = {
  rock: 0,
  ballad: 1,
  electronic: 2,
  pop: 3,
  orchestral: 4,
  other: 5,
};

// ── Fetch all songs (paginated) ──
const PAGE_SIZE = 1000;
// Tuple: [id, year, genreIndex, typeIndex, voteCount, artistId]
const listAll: Array<[number, number, number, number, number, number]> = [];
let page = 0;
let hasMore = true;

console.log("Fetching songs from Supabase...");

while (hasMore) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from("songs")
    .select("id, year, genre, type, vote_count, artist_id")
    .order("year", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  for (let i = 0; i < (data?.length ?? 0); i += 1) {
    const s = data![i];
    listAll.push([
      s.id,
      s.year ?? 2000,
      GENRE_INDEX[s.genre as string] ?? 5,
      s.type === "OP" ? 0 : 1,
      s.vote_count ?? 0,
      s.artist_id ?? 0,
    ]);
  }

  hasMore = (data?.length ?? 0) === PAGE_SIZE;
  page += 1;
  console.log(
    `  Page ${page}: ${data?.length ?? 0} songs (total: ${listAll.length})`,
  );
}

// ── Write compact JSON ──
const outPath = resolve(__dirname, "../public/galaxy-data.json");
const json = JSON.stringify(listAll);
writeFileSync(outPath, json);

const sizeKB = (json.length / 1024).toFixed(1);
console.log(`\nWrote ${listAll.length} songs to ${outPath} (${sizeKB} KB)`);
