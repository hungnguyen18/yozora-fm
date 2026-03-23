# Yozora.fm — Anime Music Galaxy Timeline

> Interactive spiral galaxy timeline of anime music from the 80s to present day.
> Users explore a galaxy where each star is an anime OP/ED, discover music across eras, and contribute as a community.

---

## 1. Overview

**Yozora.fm** (夜空.fm — "Night Sky Radio") is a web-based interactive experience that visualizes the entire history of anime music as a spiral galaxy. Each song is a star. Users zoom, pan, and orbit through decades of anime openings and endings — listening to full tracks, discovering artist constellations, and contributing trivia and votes.

**Goals:**

- Personal enjoyment: a beautiful, engaging way to explore anime music
- Community: lightweight interactions (vote, trivia, comment) that enrich the data over time
- Unique UI/UX: the galaxy metaphor must feel novel and delightful, not a gimmick

**Non-goals:**

- Not a social platform (no profiles, follows, messaging)
- Not a music streaming service (leverages YouTube/AnimeThemes for playback)
- Not a comprehensive anime database (focused on OP/ED music only)

---

## 2. Brand Identity

### 2.1 Brand Story

> Mỗi bài hát anime là một ngôi sao — gắn liền với một khoảnh khắc, một ký ức, một cảm xúc.
> Anime music không chỉ là nhạc nền. Nó là soundtrack của tuổi trẻ, là tiếng mở đầu khiến tim đập nhanh, là giai điệu ending khiến mắt cay.
> **Yozora.fm** là bầu trời đêm nơi tất cả những ngôi sao ấy tỏa sáng cùng nhau — một đài radio vũ trụ cho bạn khám phá lại, lắng nghe lại, và chia sẻ cùng cộng đồng.

**Tagline:** _"Every song is a star. Tune in to the night sky of your memories."_

**Brand personality:** Vibrant, energetic, playful — nhưng có chiều sâu cảm xúc. Không quá nghiêm túc, không quá trẻ con. Giống cảm giác khi nghe lại bài OP yêu thích sau nhiều năm — vừa phấn khích vừa xúc động. Tên "Yozora.fm" gợi lên hình ảnh nằm ngắm sao đêm, mỗi ngôi sao phát ra một giai điệu quen thuộc — vừa cosmic vừa intimate.

### 2.2 Color Palette

| Role           | Color          | Hex       | Usage                                                                 |
| -------------- | -------------- | --------- | --------------------------------------------------------------------- |
| Primary        | Indigo         | `#4F46E5` | Navigation, interactive elements, links, primary buttons              |
| Secondary      | Gold           | `#F59E0B` | Stars highlight, iconic badges, accent text, hover states             |
| Accent         | Coral          | `#F97066` | Notifications, active states, error, community actions (vote, trivia) |
| Background     | Deep Space     | `#0A0B1A` | Galaxy background, panels                                             |
| Surface        | Midnight       | `#141529` | Cards, detail panel, overlays                                         |
| Text Primary   | Soft White     | `#E8E8F0` | Body text, labels                                                     |
| Text Secondary | Muted Lavender | `#9B9BB4` | Secondary info, timestamps, placeholders                              |

**Gradient usage:**

- Galaxy nebula: radial gradients mixing Indigo → Deep Purple (`#7C3AED`) → Coral (subtle, per era)
- Star glow: Gold → White center
- Buttons/CTAs: Indigo → slightly lighter Indigo (`#6366F1`)

### 2.3 Logo

**Primary logo:** Logotype "Yozora.fm" in custom stylized font — clean, slightly rounded letterforms with a Japanese-inspired aesthetic. The "Y" incorporates a subtle spiral motif (referencing the galaxy). The ".fm" is smaller, lighter weight — feels like a radio frequency. The text has a gentle cosmic glow effect (Gold → Indigo gradient on hover/animation).

**Icon mark:** Spiral star — a five-pointed star with spiral trails extending from it, forming a mini galaxy. Used as favicon, app icon, loading spinner (animated rotation).

**Logo variants:**

- **Full:** Icon + logotype side by side (horizontal)
- **Stacked:** Icon above logotype (for square spaces)
- **Icon only:** Spiral star mark (favicon, small sizes)
- **Wordmark only:** "Yozora.fm" text (for inline/header use)

**Logo colors:**

- On dark background: Soft White text + Gold icon
- On light background (rare): Indigo text + Indigo icon

### 2.4 Typography

| Role                 | Font                             | Fallback  |
| -------------------- | -------------------------------- | --------- |
| Logo / Display       | **Space Grotesk** (Google Fonts) | system-ui |
| Headings             | **Space Grotesk** semibold       | system-ui |
| Body                 | **Inter**                        | system-ui |
| Monospace (metadata) | **JetBrains Mono**               | monospace |

Space Grotesk has a geometric, slightly futuristic feel that aligns with the cosmic theme while remaining highly readable. Inter for body text ensures readability at small sizes.

---

## 3. Core Experience — Galaxy Navigation

### 3.1 Galaxy Layout

The main view is a **top-down spiral galaxy**. The spiral has ~4-5 arms, each arm spanning from the outer edge (1980s) to the center (2020s/present).

- **Stars** = individual OP/ED songs
- **Star size** = community "iconic" vote count (more votes → larger, brighter star)
- **Star color** = genre (Rock = red-orange, Ballad = blue, Electronic = purple, Pop = pink, Orchestral = gold, Other/unclassified = white-silver)
- **Constellation lines** = faint lines connecting stars by the same artist. Hover on a star → its artist's constellation highlights

**Spiral position algorithm:**

- Each song has a `year` (e.g., 1995) and an index within that year (sorted by anime season → alphabetical)
- **Angle (θ):** mapped from year. 1980 = outermost angle (0°), 2026 = center (~4.5 full rotations = ~1620°). Formula: `θ = ((year - 1980) / 46) * 1620°`
- **Radius (r):** inversely proportional to year. `r = R_max * (1 - (year - 1980) / 46)` where R_max is the galaxy outer radius
- **Per-year spread:** songs within the same year are distributed along a small arc segment (±5° spread) and slight radial jitter (±2% of r) to avoid overlap
- **Arm assignment:** songs are distributed across 4 arms by genre cluster — each arm loosely groups related genres. Arm offset = `arm_index * 90°` added to θ
- This produces an Archimedean spiral where time flows inward, with genre-based arm clustering

### 3.4 Performance & Level of Detail (LOD)

Estimated dataset: 5,000-15,000 songs. LOD strategy to maintain 60fps:

- **Far zoom (full galaxy):** all stars rendered as a single **Three.js InstancedMesh** (one draw call). Each instance = a small billboard quad. Color/size set via instance attributes. No labels, no interactivity. Constellation lines hidden
- **Mid zoom (era level):** stars within the visible viewport switch to interactive sprites with hover detection. Labels appear for top-voted stars only (vote_count > threshold). Constellation lines appear on hover
- **Close zoom (song level):** individual stars render with glow shader, pulse animation, full labels. Click opens detail panel
- **Off-screen culling:** stars outside camera frustum are not rendered. Use spatial indexing (quadtree) for fast viewport queries
- **Device adaptation:** detect GPU capability via `renderer.capabilities`. Reduce particle dust count and disable nebula blur on low-end devices

### 3.2 Navigation Controls

- **Scroll wheel / pinch** → zoom in/out. Far zoom = entire galaxy overview. Close zoom = individual stars with labels
- **Click & drag** → pan camera position, slight orbit rotation
- **Minimap** (bottom-right corner) — shows current viewport on the full galaxy. Click to jump
- **Era indicator** (top of screen) — displays current era name + tagline when zoomed into a decade region (e.g., "1990s — The Golden Age of J-Rock")

### 3.3 Visual Design

- **Background:** deep space gradient, subtle nebula textures that shift color per era
- **Particle dust:** distant floating particles for depth
- **Stars:** subtle idle pulse animation; active star (playing music) has ripple animation radiating outward
- **Nearby stars** react with gentle vibration when music is playing
- **3D:** camera orbit with parallax depth via TresJS (Three.js Vue wrapper). Not full 3D scene — top-down with depth layers

---

## 4. Music Player & Song Detail

### 4.1 Detail Panel

Clicking a star → star zooms in + glows, a **detail panel** slides in from the right (~400px width). Galaxy background dims slightly.

**Panel contents (top to bottom):**

- **Video player** (primary) — AnimeThemes WebM playing the original OP/ED sequence. Rounded corners, glow border in the star's genre color. Song info (title, artist, anime) overlaid semi-transparent at bottom of video
- Below video: anime cover art (small), year, OP/ED type + sequence
- Genre tags (clickable → highlights all same-genre stars on galaxy)
- "View artist constellation" button → camera pans to show all stars by that artist
- Community section: iconic vote button, trivia, comments (see Section 5)

### 4.2 Playback

**Source priority (hybrid tiered):**

1. **AnimeThemes WebM** (default) — original OP/ED video from the anime, played via HTML `<video>` tag. Covers ~14,000+ themes. This is the primary experience: users watch the actual anime opening/ending while listening. Full control over playback: volume, crossfade, playback rate, Picture-in-Picture
2. **Spotify Web Playback SDK** (optional upgrade) — user can connect Spotify Premium account via "Connect Spotify" button in settings. When active, switches audio to Spotify stream (higher audio quality). Video player switches to: album art + real-time waveform visualization + particle animation reacting to audio
3. **YouTube embed** (fallback) — for songs not on AnimeThemes. Embedded as visible player (>= 200x200, YouTube ToS compliant). Used only when AnimeThemes WebM is unavailable
4. **External links** (last resort) — if no playable source: show beautiful card with album art + "Listen on Spotify / YouTube / Apple Music" buttons with hover animation

**Video player design:**

- Embedded in detail panel, 16:9 aspect ratio, fills panel width (~400x225)
- Rounded corners (12px), genre-colored glow border (subtle, animated pulse while playing)
- Custom controls overlay: play/pause, progress bar, volume slider, fullscreen toggle — styled to match Yozora.fm brand (Indigo/Gold), not browser defaults
- On hover: controls fade in. When idle: controls fade out, pure video experience

**Mini player (Picture-in-Picture):**

- When user navigates away from detail panel (clicks another area of galaxy), panel slides out and player becomes a **floating PiP window** at bottom-left (~240x135, 16:9)
- Video continues playing — user sees the OP/ED sequence while exploring the galaxy
- PiP has: drag to reposition, close button (stops playback), expand button (reopens detail panel), song title + artist below video
- Smooth transition animation from panel → PiP (video element moves + scales, no reload)
- When in Spotify mode: PiP shows album art + mini waveform instead of video

**Crossfade & transitions:**

- **2-second audio crossfade** between tracks — possible because HTML `<video>` allows programmatic volume control. Two `<video>` elements: one fading out, one fading in
- **Visual transition:** old star dims glow, camera smooth-pans to new star, new star lights up as new video fades in
- Crossfade happens in PiP too — seamless experience

**Auto-play:**

- When a song ends, auto-advance to nearest star on spiral (same era)
- Camera smooth-pans to follow. Galaxy stars along the path subtly brighten as camera passes (trail effect)
- Works reliably with HTML `<video>` — no browser autoplay restrictions after first user interaction
- User can disable auto-play in settings. When disabled, player shows "Up next: [song name]" card with play button

**Spotify mode details:**

- Settings page: "Connect Spotify" button → Spotify OAuth flow → stores token in Supabase user metadata
- When connected, a toggle appears on player: "Video mode" (AnimeThemes) / "Audio mode" (Spotify)
- Audio mode: video area becomes a visual canvas — album art centered, waveform ring around it, particles floating outward from center, all reacting to audio frequency data via Spotify Web Playback SDK's `getAudioAnalysis()`
- If a song is not on Spotify: auto-falls back to AnimeThemes WebM with a subtle toast "Playing from AnimeThemes"

**Fallback behavior:**

- AnimeThemes unavailable → YouTube embed (>= 200x200) if youtube_id exists
- YouTube unavailable → external link card (Spotify/YouTube/Apple Music buttons)
- No source at all → star still visible on galaxy, detail panel shows metadata + community content + "No playback available — help us by suggesting a link" (community contribution)
- Supabase unreachable → community features gracefully hide, playback still works (AnimeThemes is independent)

---

## 5. Community Features

### 5.1 Authentication

- **Supabase Auth** with Google and GitHub OAuth providers
- Minimal profile: nickname + avatar (pulled from OAuth provider)
- Guests can browse + listen + comment (anonymous comments allowed). Login required to vote/submit trivia

### 5.2 Iconic Vote

- Star button (⭐) on detail panel — one vote per user per song, toggle on/off
- Total votes determine star size + brightness on galaxy
- Realtime updates via Supabase Realtime subscriptions

### 5.3 Trivia / Fun Facts

- "Did you know?" section on detail panel
- Authenticated users submit trivia (max 500 characters)
- New trivia requires 3 upvotes from other users to become visible (crowd-moderation)
- Report button on trivia (same as comments) — reported trivia hidden after 3 reports pending admin review
- Top 3 trivia by upvote count displayed per song

### 5.4 Comments

- Short comments (max 280 characters)
- **Anonymous comments allowed** — no login required to post. Guest comments use a random nickname ("Anonymous Star", "Cosmic Listener", etc.)
- Authenticated users see their nickname + avatar; can delete own comments
- Show 5 most recent, "Load more" pagination
- Report button for spam

### 5.5 Search

- **SearchBar** (top-left, collapsible) — search songs, artists, or anime titles
- Full-text search via Supabase `ilike` or PostgreSQL `tsvector` (if dataset grows large)
- Results appear as a dropdown list grouped by type (Songs / Artists / Anime)
- Selecting a result → camera flies to that star on the galaxy + opens detail panel
- Selecting an artist → camera zooms to show their constellation
- Keyboard shortcut: `/` to focus search bar

### 5.6 Era Summary

When zoomed at era level (decade), a light overlay displays:

- Era name + decade
- Total song count
- Top artist (most songs)
- Most iconic song (highest vote)

---

## 6. Data Architecture

### 6.1 Supabase (via MCP)

All backend operations use Supabase MCP tools — database, auth, edge functions, migrations.

### 6.2 Database Schema (PostgreSQL)

```sql
-- Core tables
CREATE TABLE artists (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_jp VARCHAR(255),
  image_url TEXT
);

CREATE TABLE animes (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  title_jp VARCHAR(255),
  year SMALLINT,
  season VARCHAR(10) CHECK (season IN ('winter', 'spring', 'summer', 'fall')),
  cover_url TEXT,
  anilist_id INT
);

CREATE TABLE songs (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  title_jp VARCHAR(255),
  artist_id BIGINT REFERENCES artists(id),
  anime_id BIGINT REFERENCES animes(id),
  type VARCHAR(4) NOT NULL CHECK (type IN ('OP', 'ED')),
  sequence SMALLINT DEFAULT 1,
  year SMALLINT NOT NULL,
  genre VARCHAR(50),
  animethemes_slug VARCHAR(255),       -- video slug → https://v.animethemes.moe/{slug}.webm
  spotify_uri VARCHAR(255),            -- for Spotify Web Playback SDK
  youtube_id VARCHAR(20),              -- fallback player
  album_art_url TEXT,                  -- from Spotify or AniList
  vote_count INT DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_songs_year ON songs(year);
CREATE INDEX idx_songs_artist_id ON songs(artist_id);
CREATE INDEX idx_songs_anime_id ON songs(anime_id);
CREATE INDEX idx_songs_genre ON songs(genre);

-- Community tables
CREATE TABLE votes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id BIGINT REFERENCES songs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, song_id)
);

CREATE TABLE trivia (
  id BIGSERIAL PRIMARY KEY,
  song_id BIGINT REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content VARCHAR(500) NOT NULL,
  upvote_count INT DEFAULT 0,
  report_count INT DEFAULT 0,
  status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'reported')),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trivia_song_id ON trivia(song_id);
CREATE INDEX idx_trivia_status ON trivia(status);

CREATE TABLE comments (
  id BIGSERIAL PRIMARY KEY,
  song_id BIGINT REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content VARCHAR(280) NOT NULL,
  report_count INT DEFAULT 0,
  status VARCHAR(10) DEFAULT 'visible' CHECK (status IN ('visible', 'reported')),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_song_id ON comments(song_id);

CREATE TABLE trivia_upvotes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trivia_id BIGINT REFERENCES trivia(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, trivia_id)
);

-- Vote count sync: trigger to keep songs.vote_count in sync with votes table
CREATE OR REPLACE FUNCTION update_song_vote_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE songs SET vote_count = vote_count + 1 WHERE id = NEW.song_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE songs SET vote_count = vote_count - 1 WHERE id = OLD.song_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vote_count
AFTER INSERT OR DELETE ON votes
FOR EACH ROW EXECUTE FUNCTION update_song_vote_count();

-- Trivia upvote count sync + auto-approve when upvote_count >= 3
CREATE OR REPLACE FUNCTION update_trivia_upvote_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE trivia SET upvote_count = upvote_count + 1,
      status = CASE WHEN upvote_count + 1 >= 3 AND status = 'pending' THEN 'approved' ELSE status END
    WHERE id = NEW.trivia_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE trivia SET upvote_count = upvote_count - 1 WHERE id = OLD.trivia_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trivia_upvote_count
AFTER INSERT OR DELETE ON trivia_upvotes
FOR EACH ROW EXECUTE FUNCTION update_trivia_upvote_count();

-- Auto-hide reported content (trivia + comments) after 3 reports
-- Applied via RLS: WHERE status != 'reported' for public reads
-- Admin reviews reported items via Supabase Dashboard
```

### 6.3 Row Level Security (RLS)

| Table                  | Public read           | Auth write                       | Constraint         |
| ---------------------- | --------------------- | -------------------------------- | ------------------ |
| songs, artists, animes | Yes                   | Admin only                       | —                  |
| votes                  | Count only            | Insert/delete own                | Unique user+song   |
| trivia                 | Where status=approved | Insert own                       | —                  |
| comments               | Where status=visible  | Insert (anon + auth), delete own | —                  |
| trivia_upvotes         | Count only            | Insert/delete own                | Unique user+trivia |

### 6.4 Data Sources & Sync

**Initial seed (Node.js script):**

1. Download **AnimeThemes database dump** (`/dump` endpoint) — full dataset in one shot, no rate limit concerns. Contains: song titles, artists, anime associations, OP/ED type, video slugs (→ WebM URLs at `v.animethemes.moe`)
2. Enrich with metadata from **AniList API** (cover art, anime year, season) — match via AnimeThemes' AniList external resource IDs
3. Match songs on **Spotify API** via client-credentials auth for album art + release date + spotify_uri (cache results locally as JSON). Optional enrichment — AniList cover art is the primary fallback
4. YouTube IDs: extract from AnimeThemes external resource links where available. For top-voted/popular songs only, supplement via YouTube Data API search (within daily quota). YouTube is a fallback source, not primary — no need to match all 14K songs
5. Derive AnimeThemes WebM URLs from video slugs: `https://v.animethemes.moe/{slug}.webm`
6. Upsert everything into Supabase

**Ongoing sync (Supabase Edge Function, weekly cron):**

- Check AnimeThemes API for new seasonal anime themes (incremental, within 90 req/min rate limit)
- Enrich new songs with AniList + Spotify metadata
- Auto-insert into Supabase

**Admin operations:** managed via Supabase Dashboard (table editor, SQL runner). No custom admin UI for MVP

---

## 7. Tech Stack

| Layer               | Technology                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Frontend framework  | Vue 3 + Vite + TypeScript                                                                                                   |
| 3D rendering        | TresJS (Three.js Vue wrapper)                                                                                               |
| 2D effects          | Canvas API for lightweight particles, CSS animations                                                                        |
| State management    | Pinia                                                                                                                       |
| Styling             | UnoCSS or Tailwind CSS                                                                                                      |
| Backend / DB / Auth | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) via MCP                                                            |
| Music playback      | AnimeThemes WebM via HTML `<video>` (default) + Spotify Web Playback SDK (optional upgrade) + YouTube IFrame API (fallback) |
| Metadata source     | AnimeThemes API + AniList API (primary). Spotify API for enrichment (album art, release dates)                              |
| Deployment          | Vercel (frontend) + Supabase Cloud (backend)                                                                                |
| Seed tooling        | Node.js + tsx                                                                                                               |

### 7.1 Project Structure

```
yozora-fm/
├── src/
│   ├── components/
│   │   ├── galaxy/          # GalaxyScene, Star, Constellation, Nebula
│   │   ├── player/          # DetailPanel, PipPlayer, VideoPlayer, SpotifyPlayer, YouTubeFallback
│   │   ├── community/       # VoteButton, TriviaSection, CommentList
│   │   ├── navigation/      # Minimap, EraIndicator, SearchBar
│   │   └── ui/              # Shared UI primitives
│   ├── composables/         # useGalaxy, usePlayer, useAuth, useSongs, useRealtime
│   ├── stores/              # Pinia: galaxy, player, auth, songs
│   ├── lib/
│   │   └── supabase.ts      # Supabase client initialization
│   ├── types/               # TypeScript interfaces (ISong, IArtist, IAnime, etc.)
│   ├── App.vue
│   └── main.ts
├── scripts/
│   └── seed/                # Seed scripts: AnimeThemes + AniList + Spotify + YouTube
├── supabase/
│   ├── migrations/          # SQL migration files
│   └── functions/           # Edge functions (weekly sync cron)
├── public/
│   └── textures/            # Nebula images, dust particle sprites
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 8. Key UX Principles

1. **Music never stops** — navigation, zooming, panel interactions should never interrupt playback. PiP player persists across all interactions
2. **Video is a feature, not a player** — showing the original OP/ED sequence is the killer UX. Users re-experience the anime, not just listen to music
3. **No fallback feels like a fallback** — transitions between sources (AnimeThemes → Spotify → YouTube) must be seamless. Visual treatment adapts per source (video mode vs audio visualization mode), each feeling intentional
4. **Progressive disclosure** — galaxy overview is simple and beautiful. Detail emerges only on zoom/click
5. **Performance first** — particle count adapts to device capability. Lazy-load star labels. Virtualize off-screen stars
6. **Ambient feel** — the experience should feel like floating through space, not using a database. Transitions are smooth, never jarring. Crossfade audio, smooth-pan camera, glow transitions on stars
7. **Community enhances, never blocks** — all community features are optional overlays. Core experience (browse + play) works without login and without Spotify
