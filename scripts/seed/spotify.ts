import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATE_LIMIT_DELAY_MS = 100;
const LOG_INTERVAL = 100;
const CACHE_SAVE_INTERVAL = 200;
// Resolve __dirname in both ESM (import.meta.url) and CJS contexts
const _dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(_dirname, ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "spotify.json");
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ISpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ISpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

interface ISpotifyTrack {
  uri: string;
  album: {
    images: ISpotifyImage[];
  };
}

interface ISpotifySearchResponse {
  tracks: {
    items: ISpotifyTrack[];
  };
}

type TSpotifyEnrichment = {
  spotifyUri: string;
  albumArtUrl: string;
};

type TCacheData = Record<string, TSpotifyEnrichment>;

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const loadCache = (): TCacheData => {
  if (!fs.existsSync(CACHE_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as TCacheData;
  } catch {
    console.warn("[spotify] Failed to parse cache file — starting fresh.");
    return {};
  }
};

const saveCache = (cache: TCacheData): void => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const fetchAccessToken = async (
  clientId: string,
  clientSecret: string,
): Promise<string | null> => {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    console.error(
      `[spotify] Auth failed: ${response.status} ${response.statusText}`,
    );
    return null;
  }

  const data = (await response.json()) as ISpotifyTokenResponse;
  return data.access_token;
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const searchTrack = async (
  token: string,
  artistName: string,
  title: string,
): Promise<TSpotifyEnrichment | null> => {
  const query = encodeURIComponent(`artist:${artistName} track:${title}`);
  const url = `${SPOTIFY_SEARCH_URL}?q=${query}&type=track&limit=1`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    console.warn(
      `[spotify] Search failed for "${title}" by "${artistName}": ${response.status}`,
    );
    return null;
  }

  const data = (await response.json()) as ISpotifySearchResponse;
  const track = data.tracks.items[0];

  if (!track) {
    return null;
  }

  const albumArtUrl = track.album.images[0]?.url ?? "";

  return {
    spotifyUri: track.uri,
    albumArtUrl,
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const enrichWithSpotify = async (
  listSong: Array<{ title: string; artistName: string }>,
): Promise<Map<string, TSpotifyEnrichment>> => {
  const result = new Map<string, TSpotifyEnrichment>();

  const clientId = process.env["SPOTIFY_CLIENT_ID"];
  const clientSecret = process.env["SPOTIFY_CLIENT_SECRET"];

  if (!clientId || !clientSecret) {
    console.warn(
      "[spotify] SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET not set — skipping enrichment.",
    );
    return result;
  }

  const token = await fetchAccessToken(clientId, clientSecret);
  if (!token) {
    console.error(
      "[spotify] Could not obtain access token — returning empty map.",
    );
    return result;
  }

  // Load existing cache and pre-populate result from it
  const cache = loadCache();
  for (const [key, value] of Object.entries(cache)) {
    result.set(key, value);
  }

  // Skip songs already in cache
  const listToProcess = listSong.filter(
    (song) => !result.has(`${song.artistName}|${song.title}`),
  );

  const total = listToProcess.length;
  const cached = Object.keys(cache).length;
  console.log(
    `[spotify] ${listSong.length} total songs, ${cached} cached, ${total} to fetch`,
  );

  let found = 0;

  for (let i = 0; i < total; i += 1) {
    const song = listToProcess[i];
    const key = `${song.artistName}|${song.title}`;

    if (i > 0 && i % LOG_INTERVAL === 0) {
      const pct = ((i / total) * 100).toFixed(1);
      console.log(
        `[spotify] Progress: ${i}/${total} (${pct}%) — ${found} found`,
      );
    }

    try {
      const enrichment = await searchTrack(token, song.artistName, song.title);
      if (enrichment) {
        result.set(key, enrichment);
        cache[key] = enrichment;
        found += 1;
      }
    } catch (err) {
      console.warn(
        `[spotify] Error searching "${song.title}" by "${song.artistName}":`,
        err,
      );
    }

    // Periodically save cache so progress is not lost on interruption
    if (i > 0 && i % CACHE_SAVE_INTERVAL === 0) {
      saveCache(cache);
    }

    await delay(RATE_LIMIT_DELAY_MS);
  }

  if (total > 0) {
    console.log(
      `[spotify] Done: ${total} processed, ${found} found, ${Object.keys(cache).length} total cached`,
    );
    saveCache(cache);
  }

  return result;
};
