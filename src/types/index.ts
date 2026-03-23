// ---------------------------------------------------------------------------
// Primitive / scalar types
// ---------------------------------------------------------------------------

export type TSongType = "OP" | "ED";

export type TSeason = "winter" | "spring" | "summer" | "fall";

export type TTriviaStatus = "pending" | "approved" | "reported";

export type TCommentStatus = "visible" | "reported";

export type TGenre =
  | "rock"
  | "ballad"
  | "electronic"
  | "pop"
  | "orchestral"
  | "other";

// LOD (Level of Detail) tier for galaxy rendering
export type TLodTier = "far" | "mid" | "close";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Maps each genre to its representative star/label colour in the galaxy view
export const GENRE_COLOR_MAP: Record<TGenre, string> = {
  rock: "#F97316", // red-orange
  ballad: "#3B82F6", // blue
  electronic: "#A855F7", // purple
  pop: "#EC4899", // pink
  orchestral: "#F59E0B", // gold
  other: "#C0C0D0", // white-silver
};

// ---------------------------------------------------------------------------
// Core DB-backed interfaces
// ---------------------------------------------------------------------------

export interface IArtist {
  id: number;
  name: string;
  name_jp?: string;
  image_url?: string;
}

export interface IAnime {
  id: number;
  title: string;
  title_jp?: string;
  year?: number;
  season?: TSeason;
  cover_url?: string;
  anilist_id?: number;
}

export interface ISong {
  id: number;
  title: string;
  title_jp?: string;
  artist_id: number;
  anime_id: number;
  type: TSongType;
  sequence?: number;
  year?: number;
  genre?: TGenre;
  animethemes_slug?: string;
  spotify_uri?: string;
  youtube_id?: string;
  album_art_url?: string;
  vote_count: number;
  created_at: string;

  // Populated when joining related tables
  artist?: IArtist;
  anime?: IAnime;
}

export interface IVote {
  user_id: string; // UUID
  song_id: number;
  created_at: string;
}

export interface IUser {
  id: string; // UUID from Supabase Auth
  nickname: string;
  avatarUrl: string;
  provider: "google" | "github";
}

export interface ITrivia {
  id: number;
  song_id: number;
  user_id: string; // UUID
  content: string;
  upvote_count: number;
  report_count: number;
  status: TTriviaStatus;
  created_at: string;

  // Populated when joining auth/profile data for display
  user?: IUser;
}

export interface IComment {
  id: number;
  song_id: number;
  user_id: string | null; // UUID — null for anonymous comments
  content: string;
  report_count: number;
  status: TCommentStatus;
  created_at: string;

  // Populated when joining auth/profile data for display
  user?: IUser;
}

export interface ITriviaUpvote {
  user_id: string; // UUID
  trivia_id: number;
}

// ---------------------------------------------------------------------------
// Galaxy / visualisation types
// ---------------------------------------------------------------------------

export interface IStarPosition {
  x: number;
  y: number;
  z: number;
  angle: number; // θ in radians
  radius: number; // distance from the galaxy centre
  songId: number;
}

export interface IEra {
  decade: number; // e.g. 1980, 1990
  name: string; // e.g. "The Golden Age of J-Rock"
  startYear: number;
  endYear: number;
}
