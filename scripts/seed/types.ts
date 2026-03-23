// ---------------------------------------------------------------------------
// AnimeThemes API raw response types
// ---------------------------------------------------------------------------

export interface TAnimeThemesVideo {
  id: number;
  basename: string;
  link: string;
  resolution: number | null;
  source: string | null;
}

export interface TAnimeThemesArtist {
  id: number;
  name: string;
  slug: string;
  // credited name override (e.g. a unit/alias used for this song)
  as: string | null;
}

export interface TAnimeThemesSong {
  id: number;
  title: string | null;
  artists: TAnimeThemesArtist[];
}

export interface TAnimeThemesEntry {
  id: number;
  videos: TAnimeThemesVideo[];
}

export interface TAnimeThemesTheme {
  id: number;
  // 'OP' | 'ED' — the API may omit sequence for the first entry
  type: string;
  sequence: number | null;
  slug: string;
  song: TAnimeThemesSong | null;
  animethemeentries: TAnimeThemesEntry[];
}

export interface TAnimeThemesResource {
  id: number;
  link: string;
  external_id: number | null;
  // e.g. 'MyAnimeList', 'AniList', 'YouTube', 'Twitter', etc.
  site: string;
}

export interface TAnimeThemesAnime {
  id: number;
  name: string;
  slug: string;
  year: number | null;
  season: string | null;
  animethemes: TAnimeThemesTheme[];
  resources: TAnimeThemesResource[];
}

// Envelope returned by the paginated list endpoint
export interface TAnimeThemesListResponse {
  anime: TAnimeThemesAnime[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// Internal seed types — used by seed scripts to write into Supabase
// ---------------------------------------------------------------------------

export interface ISeedArtist {
  name: string;
  nameJp?: string;
}

export interface ISeedAnime {
  title: string;
  titleJp?: string;
  year?: number;
  season?: string;
  anilistId?: number;
  coverUrl?: string;
}

export interface ISeedSong {
  title: string;
  titleJp?: string;
  type: 'OP' | 'ED';
  sequence: number;
  year: number;
  genre?: string;
  animethemesSlug?: string;
  youtubeId?: string;
  // resolved artist name (from song.artists[0].as ?? song.artists[0].name)
  artistName: string;
  // parent anime title — used to resolve the FK during insert
  animeTitle: string;
}
