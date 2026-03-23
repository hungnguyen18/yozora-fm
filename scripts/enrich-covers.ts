import { readFileSync } from "node:fs";
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
// Supabase client
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env["VITE_SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const FETCH_BATCH_SIZE = 1000;
const UPDATE_BATCH_SIZE = 50;
const REQUEST_DELAY_MS = 800;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IAnimeRow {
  id: number;
  title: string;
  anilist_id: number | null;
}

interface TAnilistSearchResponse {
  data: {
    Media: {
      coverImage: { large: string } | null;
    } | null;
  } | null;
  errors?: Array<{ message: string }>;
}

interface TAnilistIdResponse {
  data: {
    Media: {
      coverImage: { large: string } | null;
    } | null;
  } | null;
  errors?: Array<{ message: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const SEARCH_QUERY = `
  query ($search: String) {
    Media(search: $search, type: ANIME) {
      coverImage { large }
    }
  }
`;

const ID_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      coverImage { large }
    }
  }
`;

const fetchCoverByAnilistId = async (
  anilistId: number,
): Promise<string | null> => {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: ID_QUERY, variables: { id: anilistId } }),
  });

  if (response.status === 429) {
    console.warn("  Rate limited — waiting 60s...");
    await sleep(60_000);
    return fetchCoverByAnilistId(anilistId);
  }

  if (!response.ok) {
    throw new Error(`AniList responded with status ${response.status}`);
  }

  const json = (await response.json()) as TAnilistIdResponse;
  return json.data?.Media?.coverImage?.large ?? null;
};

const fetchCoverByTitle = async (title: string): Promise<string | null> => {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: title } }),
  });

  if (response.status === 429) {
    console.warn("  Rate limited — waiting 60s...");
    await sleep(60_000);
    return fetchCoverByTitle(title);
  }

  if (!response.ok) {
    throw new Error(`AniList responded with status ${response.status}`);
  }

  const json = (await response.json()) as TAnilistSearchResponse;
  return json.data?.Media?.coverImage?.large ?? null;
};

// ---------------------------------------------------------------------------
// Fetch all animes without cover_url
// ---------------------------------------------------------------------------

const fetchAnimesWithoutCover = async (): Promise<IAnimeRow[]> => {
  const listAnime: IAnimeRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("animes")
      .select("id, title, anilist_id")
      .is("cover_url", null)
      .range(from, from + FETCH_BATCH_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch animes: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (let i = 0; i < data.length; i += 1) {
      listAnime.push(data[i] as IAnimeRow);
    }

    if (data.length < FETCH_BATCH_SIZE) {
      break;
    }

    from += FETCH_BATCH_SIZE;
  }

  return listAnime;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const run = async (): Promise<void> => {
  const startTime = Date.now();

  console.log("Fetching animes without cover_url...");
  const listAnime = await fetchAnimesWithoutCover();
  console.log(`Found ${listAnime.length} animes without cover art.\n`);

  if (listAnime.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let countUpdated = 0;
  let countSkipped = 0;
  let countFailed = 0;

  // Process in batches of UPDATE_BATCH_SIZE
  for (
    let batchStart = 0;
    batchStart < listAnime.length;
    batchStart += UPDATE_BATCH_SIZE
  ) {
    const batchEnd = Math.min(batchStart + UPDATE_BATCH_SIZE, listAnime.length);
    const batch = listAnime.slice(batchStart, batchEnd);
    const batchNum = Math.floor(batchStart / UPDATE_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(listAnime.length / UPDATE_BATCH_SIZE);

    console.log(
      `--- Batch ${batchNum}/${totalBatches} (items ${batchStart + 1}-${batchEnd}) ---`,
    );

    for (let i = 0; i < batch.length; i += 1) {
      const anime = batch[i];

      try {
        // Prefer lookup by anilist_id, fall back to title search
        let coverUrl: string | null = null;

        if (anime.anilist_id !== null) {
          coverUrl = await fetchCoverByAnilistId(anime.anilist_id);
        }

        if (coverUrl === null) {
          coverUrl = await fetchCoverByTitle(anime.title);
        }

        if (coverUrl === null) {
          countSkipped += 1;
          console.log(`  [SKIP] ${anime.title} — no cover found`);
          await sleep(REQUEST_DELAY_MS);
          continue;
        }

        // Update Supabase
        const { error: updateError } = await supabase
          .from("animes")
          .update({ cover_url: coverUrl })
          .eq("id", anime.id);

        if (updateError) {
          countFailed += 1;
          console.log(`  [FAIL] ${anime.title} — ${updateError.message}`);
        } else {
          countUpdated += 1;
          console.log(`  [OK]   ${anime.title}`);
        }
      } catch (err) {
        countFailed += 1;
        console.log(`  [ERR]  ${anime.title} — ${(err as Error).message}`);
      }

      // Rate limit: wait between AniList requests (skip after last item)
      if (batchStart + i < listAnime.length - 1) {
        await sleep(REQUEST_DELAY_MS);
      }
    }

    const progress = ((batchEnd / listAnime.length) * 100).toFixed(1);
    console.log(
      `Progress: ${progress}% | Updated: ${countUpdated} | Skipped: ${countSkipped} | Failed: ${countFailed}\n`,
    );
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("=== Enrichment complete ===");
  console.log(`Updated: ${countUpdated}`);
  console.log(`Skipped: ${countSkipped}`);
  console.log(`Failed:  ${countFailed}`);
  console.log(`Time:    ${elapsed}s`);
};

run().catch((err) => {
  console.error("Enrich covers failed:", err);
  process.exit(1);
});
