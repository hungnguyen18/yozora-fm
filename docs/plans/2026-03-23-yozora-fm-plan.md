# Yozora.fm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive spiral galaxy timeline of anime music where each star is a song, users can explore eras, listen to OP/ED videos, and interact as a community.

**Architecture:** Vue 3 SPA with TresJS for 3D galaxy rendering. Supabase handles database, auth, and realtime. AnimeThemes WebM for default playback via HTML `<video>`. Data seeded from AnimeThemes dump + AniList API.

**Tech Stack:** Vue 3 + Vite + TypeScript, TresJS (Three.js), Pinia, Tailwind CSS, Supabase (PostgreSQL + Auth + Realtime), AnimeThemes API, AniList API

**Spec:** `docs/specs/2026-03-23-yozora-fm-design.md`

---

## Phase 0: Git & GitHub Init

> Initialize repo first so all subsequent phases can commit.

### Task 0.1: Git Init & GitHub Repository

**Files:**

- Create: `.gitignore`

- [ ] **Step 1: Init git repo**

```bash
cd /Users/hungnguyen/Workspace/me/yozora-fm
git init
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
.env.local
.DS_Store
*.log
```

- [ ] **Step 3: Initial commit**

```bash
git add .gitignore package.json package-lock.json vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json index.html src/ public/
git commit -S -m "feat: init Yozora.fm project (Vue 3 + Vite + TypeScript)"
```

- [ ] **Step 4: Create GitHub repo + push**

```bash
gh repo create yozora-fm --public --source=. --push
```

---

## Phase 1: Project Foundation & Data Layer

> Get the project scaffold, Supabase DB, and seed data working. End result: data in DB, types defined, Supabase client connected.

### Task 1.1: Project Setup & Dependencies

**Files:**

- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`, `tsconfig.app.json`
- Create: `src/lib/supabase.ts`
- Create: `tailwind.config.ts`
- Create: `src/style.css` (replace existing)
- Create: `.env.local` (gitignored)
- Create: `.env.example`

- [ ] **Step 1: Install all dependencies**

```bash
npm install @tresjs/core three @supabase/supabase-js pinia @vueuse/core
npm install -D @types/three tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Configure Tailwind with Yozora.fm brand tokens**

Create `tailwind.config.ts` with brand colors from spec:

```ts
// Colors: indigo #4F46E5, gold #F59E0B, coral #F97066
// Background: deep-space #0A0B1A, midnight #141529
// Text: soft-white #E8E8F0, lavender #9B9BB4
```

- [ ] **Step 3: Update `vite.config.ts`** — add Tailwind plugin

- [ ] **Step 4: Replace `src/style.css`** — Tailwind directives + Google Fonts imports (Space Grotesk, Inter, JetBrains Mono) + base dark background

- [ ] **Step 5: Create `.env.example` and `.env.local`**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only, used by seed script
SPOTIFY_CLIENT_ID=                   # for Spotify API enrichment
SPOTIFY_CLIENT_SECRET=               # for Spotify API enrichment
```

- [ ] **Step 6: Create `src/lib/supabase.ts`** — init Supabase client from env vars

- [ ] **Step 7: Update `src/main.ts`** — register Pinia, import styles

- [ ] **Step 8: Clean up Vite scaffold** — remove HelloWorld.vue, default assets, update App.vue to minimal shell

- [ ] **Step 9: Verify dev server starts clean**

```bash
npm run dev
```

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.ts tailwind.config.ts src/ .env.example && git commit -S -m "feat: project setup with Vue 3, TresJS, Tailwind, Supabase, Pinia"
```

---

### Task 1.2: TypeScript Types & Interfaces

**Files:**

- Create: `src/types/index.ts`

- [ ] **Step 1: Define all interfaces**

```ts
// ISong, IArtist, IAnime, IVote, ITrivia, IComment
// TSongType = 'OP' | 'ED'
// TGenre with color mapping
// TSeason = 'winter' | 'spring' | 'summer' | 'fall'
// IStarPosition { x, y, z, angle, radius }
```

All interfaces match the DB schema from spec Section 6.2. Use `I` prefix for interfaces, `T` prefix for types per project conventions.

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts && git commit -S -m "feat: add TypeScript interfaces for all data models"
```

---

### Task 1.3: Supabase Database Setup

**Files:**

- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/migrations/002_rls_policies.sql`

- [ ] **Step 1: Create Supabase project** via Supabase MCP or Dashboard

- [ ] **Step 2: Write `001_initial_schema.sql`** — copy exact SQL from spec Section 6.2 (all CREATE TABLE, indexes, triggers, functions)

- [ ] **Step 3: Run schema migration** via Supabase MCP `apply_migration`

- [ ] **Step 4: Write `002_rls_policies.sql`** — RLS policies per spec Section 6.3:
- Enable RLS on all tables
- songs/artists/animes: public SELECT, service_role INSERT/UPDATE/DELETE
- votes: authenticated INSERT/DELETE (where user_id = auth.uid()), public SELECT (count)
- trivia: public SELECT (where status = 'approved'), authenticated INSERT
- comments: public SELECT (where status = 'visible'), authenticated INSERT/DELETE (own)
- trivia_upvotes: authenticated INSERT/DELETE (own)

- [ ] **Step 5: Run RLS migration** via Supabase MCP `apply_migration`

- [ ] **Step 6: Configure Auth providers** — enable Google + GitHub OAuth in Supabase Dashboard

- [ ] **Step 7: Update `.env.local`** with actual Supabase URL + anon key + service role key

- [ ] **Step 8: Verify connection** — quick test query from dev app

- [ ] **Step 9: Commit**

```bash
git add supabase/ && git commit -S -m "feat: add Supabase schema migration with RLS policies"
```

---

### Task 1.4a: Seed Script — AnimeThemes Parser

**Files:**

- Create: `scripts/seed/types.ts` — raw API response types
- Create: `scripts/seed/animethemes.ts` — fetch dump + parse

- [ ] **Step 1: Create `scripts/seed/types.ts`** — types for AnimeThemes dump, AniList responses, Spotify responses, and internal seed types

- [ ] **Step 2: Create `scripts/seed/animethemes.ts`**
- Download database dump from AnimeThemes `/dump` endpoint
- Parse: extract anime → themes → songs → artists → video slugs
- Map to internal types
- Extract AniList external resource IDs for enrichment
- Extract YouTube external resource links where available (for youtube_id)

- [ ] **Step 3: Test parser** with downloaded dump (log counts + sample records)

- [ ] **Step 4: Commit**

```bash
git add scripts/seed/types.ts scripts/seed/animethemes.ts && git commit -S -m "feat: add AnimeThemes dump parser for seed pipeline"
```

---

### Task 1.4b: Seed Script — AniList Enrichment

**Files:**

- Create: `scripts/seed/anilist.ts` — enrich metadata from AniList

- [ ] **Step 1: Create `scripts/seed/anilist.ts`**
- Batch query AniList GraphQL API by IDs (from AnimeThemes external resources)
- Extract: cover art URL, anime year, season
- Respect rate limits (90 req/min on AniList)
- Cache results locally as JSON to avoid re-querying

- [ ] **Step 2: Test enrichment** on small subset (20 anime)

- [ ] **Step 3: Commit**

```bash
git add scripts/seed/anilist.ts && git commit -S -m "feat: add AniList enrichment for seed pipeline"
```

---

### Task 1.4c: Seed Script — Spotify Enrichment

**Files:**

- Create: `scripts/seed/spotify.ts` — match songs for album art + spotify_uri

- [ ] **Step 1: Create `scripts/seed/spotify.ts`**
- Spotify client-credentials OAuth flow (uses SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET from env)
- Search songs by "artist + title" on Spotify
- Extract: album_art_url, spotify_uri, release_date
- Cache results locally as JSON
- This is optional enrichment — songs without Spotify match keep AniList cover_url as fallback

- [ ] **Step 2: Test on small subset** (50 songs)

- [ ] **Step 3: Commit**

```bash
git add scripts/seed/spotify.ts && git commit -S -m "feat: add Spotify enrichment for seed pipeline"
```

---

### Task 1.4d: Seed Script — Upsert & Orchestration

**Files:**

- Create: `scripts/seed/upsert.ts` — batch upsert to Supabase
- Create: `scripts/seed/index.ts` — orchestration
- Modify: `package.json` — add `"seed"` script

- [ ] **Step 1: Create `scripts/seed/upsert.ts`**
- Batch upsert artists → animes → songs to Supabase
- Use Supabase JS client with service role key (SUPABASE_SERVICE_ROLE_KEY)
- Batch size: 500 rows per upsert
- Handle conflicts via ON CONFLICT DO UPDATE

- [ ] **Step 2: Create `scripts/seed/index.ts`** — orchestrate pipeline:

1. Parse AnimeThemes dump (animethemes.ts)
2. Enrich with AniList (anilist.ts)
3. Enrich with Spotify (spotify.ts) — optional, skip if no credentials
4. Upsert to Supabase (upsert.ts)

- Add progress logging at each stage

- [ ] **Step 3: Add script to `package.json`**

```json
"seed": "npx tsx scripts/seed/index.ts"
```

- [ ] **Step 4: Test seed with small subset** (limit to 100 anime)

- [ ] **Step 5: Run full seed** — expect ~4,700 anime, ~14,000 songs

- [ ] **Step 6: Verify data in Supabase** — spot check counts, verify animethemes_slug, spotify_uri, youtube_id populated where available

- [ ] **Step 7: Commit**

```bash
git add scripts/seed/upsert.ts scripts/seed/index.ts package.json && git commit -S -m "feat: add seed orchestration and upsert (AnimeThemes + AniList + Spotify → Supabase)"
```

---

### Task 1.5: Pinia Stores & Realtime Composable

**Files:**

- Create: `src/stores/songs.ts`
- Create: `src/stores/galaxy.ts`
- Create: `src/stores/player.ts`
- Create: `src/stores/auth.ts`
- Create: `src/composables/useRealtime.ts`

- [ ] **Step 1: Create `src/stores/songs.ts`**
- `fetchSongs()` — load all songs with artist + anime joins from Supabase
- `fetchSongsByEra(decade)` — filtered query
- `searchSongs(query)` — ilike search on title, artist name, anime title
- State: `listSong`, `isLoading`, `currentSong`

- [ ] **Step 2: Create `src/stores/galaxy.ts`**
- `computeStarPositions(songs)` — implements spiral position algorithm from spec Section 3.1
- State: `listStarPosition`, `zoomLevel`, `focusedEra`, `hoveredStarId`
- Getters: `visibleStars` (filtered by viewport), `eraStats`

- [ ] **Step 3: Create `src/stores/player.ts`**
- State: `currentSong`, `isPlaying`, `isPip`, `volume`, `autoPlay`
- Actions: `play(song)`, `pause()`, `next()`, `setVolume()`, `togglePip()`

- [ ] **Step 4: Create `src/stores/auth.ts`**
- `signInWithGoogle()`, `signInWithGithub()`, `signOut()`
- State: `user`, `isAuthenticated`
- Uses Supabase Auth

- [ ] **Step 5: Create `src/composables/useRealtime.ts`**
- Subscribe to Supabase Realtime channels for:
  - `votes` table changes → update song vote_count in songs store → update star size in galaxy
  - `comments` table inserts → update comment list if viewing that song
- Cleanup subscriptions on component unmount
- Reusable: `useRealtimeVotes(songId)`, `useRealtimeComments(songId)`

- [ ] **Step 6: Commit**

```bash
git add src/stores/ src/composables/useRealtime.ts && git commit -S -m "feat: add Pinia stores and realtime composable"
```

---

## Phase 2: Galaxy Visualization (Core Experience)

> Build the 3D spiral galaxy with TresJS. End result: interactive galaxy with stars you can zoom, pan, hover, and click.

### Task 2.1: Basic TresJS Scene

**Files:**

- Create: `src/components/galaxy/GalaxyScene.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Create `GalaxyScene.vue`** — TresCanvas with:
- OrthographicCamera (top-down view)
- Deep space background color (#0A0B1A)
- OrbitControls (pan + zoom, disable rotate for top-down)
- Ambient light

- [ ] **Step 2: Mount in `App.vue`** — full viewport GalaxyScene

- [ ] **Step 3: Verify** — dark canvas renders, can pan/zoom with mouse

- [ ] **Step 4: Commit**

```bash
git add src/components/galaxy/ src/App.vue && git commit -S -m "feat: add basic TresJS galaxy scene with camera controls"
```

---

### Task 2.2: Star Rendering with InstancedMesh

**Files:**

- Create: `src/components/galaxy/StarField.vue`
- Create: `src/composables/useGalaxyLayout.ts`

- [ ] **Step 1: Create `useGalaxyLayout.ts`** — composable implementing spiral position algorithm:
- Input: array of songs
- Output: Float32Array of positions + Float32Array of colors + Float32Array of sizes
- Algorithm: Archimedean spiral, year → angle/radius, genre → arm, jitter for spread
- All computation done once, stored in typed arrays for InstancedMesh

- [ ] **Step 2: Create `StarField.vue`** — TresInstancedMesh component:
- PlaneGeometry (small billboard quad) as base geometry
- Custom ShaderMaterial with:
  - Per-instance color (genre-based)
  - Per-instance size (vote_count-based)
  - Glow effect (additive blending)
  - Subtle pulse animation in vertex shader
- Set instance matrices from computed positions
- Bypass Vue reactivity — write directly to instance buffers

- [ ] **Step 3: Load song data from store, pass to StarField**

- [ ] **Step 4: Verify** — galaxy renders with colored stars in spiral pattern

- [ ] **Step 5: Commit**

```bash
git add src/components/galaxy/StarField.vue src/composables/useGalaxyLayout.ts && git commit -S -m "feat: render star field with InstancedMesh spiral layout"
```

---

### Task 2.3: Star Interaction (Hover + Click)

**Files:**

- Create: `src/composables/useStarInteraction.ts`
- Modify: `src/components/galaxy/StarField.vue`
- Modify: `src/components/galaxy/GalaxyScene.vue`

- [ ] **Step 1: Create `useStarInteraction.ts`**
- Raycasting: on mouse move, raycast against InstancedMesh to find hovered instance ID
- Map instance ID → song data
- On click: emit selected song to store
- On hover: set hovered star ID in galaxy store
- Use quadtree spatial index for performance at 15K stars

- [ ] **Step 2: Update `StarField.vue`** — apply hover effect:
- Hovered star: increase size + brighten color
- Nearby stars: slight glow increase
- Show tooltip with song title (CSS overlay positioned via 3D→screen projection)

- [ ] **Step 3: Update `GalaxyScene.vue`** — wire up interaction composable

- [ ] **Step 4: Verify** — hover shows tooltip, click logs song to console

- [ ] **Step 5: Commit**

```bash
git add src/composables/useStarInteraction.ts src/components/galaxy/ && git commit -S -m "feat: add star hover and click interaction with raycasting"
```

---

### Task 2.4: Background Nebula & Particle Dust

**Files:**

- Create: `src/components/galaxy/Nebula.vue`
- Create: `src/components/galaxy/ParticleDust.vue`
- Modify: `src/components/galaxy/GalaxyScene.vue`

- [ ] **Step 1: Create `Nebula.vue`** — large background planes with:
- Radial gradient textures (generated via canvas or loaded from `public/textures/`)
- Colors shift per era region: Indigo → Deep Purple → subtle Coral
- Multiple overlapping layers at different depths for parallax
- Low opacity, additive blending

- [ ] **Step 2: Create `ParticleDust.vue`** — Points geometry with:
- 2000-5000 small particles scattered across the scene
- Slow random drift animation
- Very subtle, creates depth without distraction
- Count adapts to device capability

- [ ] **Step 3: Add to `GalaxyScene.vue`** — render behind star field

- [ ] **Step 4: Verify** — galaxy now has depth and atmosphere

- [ ] **Step 5: Commit**

```bash
git add src/components/galaxy/ public/textures/ && git commit -S -m "feat: add nebula background and particle dust atmosphere"
```

---

### Task 2.5: LOD System & Performance

**Files:**

- Create: `src/composables/useLOD.ts`
- Modify: `src/components/galaxy/StarField.vue`

- [ ] **Step 1: Create `useLOD.ts`** — composable that:
- Tracks current zoom level from camera
- Returns LOD tier: 'far' | 'mid' | 'close'
- Computes visible star IDs based on camera frustum + quadtree
- Throttled updates (not every frame)

- [ ] **Step 2: Update `StarField.vue`** — apply LOD:
- Far: InstancedMesh only, no labels, no hover detection
- Mid: enable hover detection for visible stars, show labels for top-voted
- Close: full interaction, glow shader, all labels
- Transition between LOD levels smoothly (fade in/out labels)

- [ ] **Step 3: Add device adaptation** — detect GPU tier, reduce particle count on low-end

- [ ] **Step 4: Verify** — smooth 60fps with 10K+ stars at all zoom levels

- [ ] **Step 5: Commit**

```bash
git add src/composables/useLOD.ts src/components/galaxy/ && git commit -S -m "feat: add LOD system for star field performance"
```

---

### Task 2.6: Navigation UI — Era Indicator + Minimap

**Files:**

- Create: `src/components/navigation/EraIndicator.vue`
- Create: `src/components/navigation/Minimap.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Create `EraIndicator.vue`** — top of screen overlay:
- Shows current era name + tagline when zoomed into a decade
- Fade in/out based on zoom level
- Era definitions: 80s "The Dawn of Anime Music", 90s "The Golden Age of J-Rock", 2000s "Digital Revolution", 2010s "The Streaming Era", 2020s "New Frontier"

- [ ] **Step 2: Create `Minimap.vue`** — bottom-right corner:
- Small canvas rendering simplified galaxy overview (just dots)
- Rectangle showing current viewport
- Click to jump camera to location
- Semi-transparent, doesn't block galaxy view

- [ ] **Step 3: Wire up to App.vue**

- [ ] **Step 4: Verify** — era indicator shows on zoom, minimap navigates correctly

- [ ] **Step 5: Commit**

```bash
git add src/components/navigation/ src/App.vue && git commit -S -m "feat: add era indicator and minimap navigation"
```

---

## Phase 3: Music Player & Detail Panel

> Build the playback system. End result: click a star → see detail panel → watch/listen to the OP/ED.

### Task 3.1: Detail Panel Shell

**Files:**

- Create: `src/components/player/DetailPanel.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Create `DetailPanel.vue`** — slide-in panel from right:
- 400px width, full height
- Deep space background (#141529) with subtle border
- Slide animation (transform translateX)
- Shows when a song is selected in player store
- Close button → deselects song
- Layout: video area (top) → song info → genre tags (clickable → set `highlightedGenre` in galaxy store → all same-genre stars glow on galaxy) → artist link → community section (placeholder)

- [ ] **Step 2: Wire to App.vue** — show/hide based on player store

- [ ] **Step 3: Verify** — click star → panel slides in with song data, close dismisses

- [ ] **Step 4: Commit**

```bash
git add src/components/player/DetailPanel.vue src/App.vue && git commit -S -m "feat: add detail panel shell with slide animation"
```

---

### Task 3.2: Video Player (AnimeThemes WebM)

**Files:**

- Create: `src/components/player/VideoPlayer.vue`
- Create: `src/composables/usePlayer.ts`
- Modify: `src/components/player/DetailPanel.vue`

- [ ] **Step 1: Create `usePlayer.ts`** — composable managing playback:
- Two `<video>` element refs (for crossfade)
- `play(song)` — set src to `https://v.animethemes.moe/{slug}.webm`, play
- `crossfadeTo(song)` — fade out current, fade in new over 2 seconds
- Volume control, progress tracking
- `ended` event → trigger auto-play next if enabled

- [ ] **Step 2: Create `VideoPlayer.vue`** — custom video player:
- 16:9 aspect ratio, fills panel width
- Rounded corners (12px), genre-colored glow border (animated pulse while playing)
- Custom controls overlay: play/pause, progress bar, volume slider, fullscreen
- Controls fade in on hover, fade out when idle (3s timeout)
- Styled with Yozora.fm brand (Indigo/Gold)
- Two stacked `<video>` elements for crossfade (one hidden during single play)

- [ ] **Step 3: Integrate into DetailPanel**

- [ ] **Step 4: Verify** — click star → video plays with custom controls + genre glow border

- [ ] **Step 5: Commit**

```bash
git add src/components/player/VideoPlayer.vue src/composables/usePlayer.ts src/components/player/DetailPanel.vue && git commit -S -m "feat: add AnimeThemes video player with custom controls and crossfade"
```

---

### Task 3.3: PiP (Picture-in-Picture) Mini Player

**Files:**

- Create: `src/components/player/PipPlayer.vue`
- Modify: `src/composables/usePlayer.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: Create `PipPlayer.vue`** — floating window:
- 240x135 (16:9), positioned bottom-left
- Draggable (via @vueuse/core `useDraggable`)
- Shows video continuing to play (same `<video>` element, re-parented via DOM)
- Song title + artist below video
- Close button (stops playback), expand button (reopens detail panel)
- Smooth border glow matching genre color

- [ ] **Step 2: Update `usePlayer.ts`** — add PiP state management:
- `togglePip()` — transition video element between panel and PiP container
- No video reload on transition (move DOM node)

- [ ] **Step 3: Update App.vue** — render PipPlayer when in PiP mode

- [ ] **Step 4: Wire transition** — closing detail panel auto-triggers PiP if playing

- [ ] **Step 5: Verify** — click away from detail panel → video shrinks to PiP → can drag, expand back

- [ ] **Step 6: Commit**

```bash
git add src/components/player/PipPlayer.vue src/composables/usePlayer.ts src/App.vue && git commit -S -m "feat: add floating PiP mini player with drag and expand"
```

---

### Task 3.4: Auto-play & Track Transitions

**Files:**

- Modify: `src/composables/usePlayer.ts`
- Modify: `src/stores/player.ts`
- Modify: `src/stores/galaxy.ts`

- [ ] **Step 1: Implement auto-play logic in player store**
- On `ended` event: find nearest star on spiral (same era)
- Call `crossfadeTo(nextSong)`
- Update galaxy store: camera should smooth-pan to next star

- [ ] **Step 2: Add camera animation in galaxy store**
- `flyToStar(songId)` — smooth camera pan + zoom to target star position
- Stars along the camera path subtly brighten (trail effect)
- Use requestAnimationFrame for smooth interpolation

- [ ] **Step 3: Add auto-play toggle in player store** — persist preference in localStorage

- [ ] **Step 4: Verify** — song ends → crossfade to next → camera follows → trail effect visible

- [ ] **Step 5: Commit**

```bash
git add src/composables/ src/stores/ && git commit -S -m "feat: add auto-play with crossfade and camera follow"
```

---

### Task 3.5: YouTube Fallback Player

**Files:**

- Create: `src/components/player/YouTubeFallback.vue`
- Modify: `src/components/player/DetailPanel.vue`
- Modify: `src/composables/usePlayer.ts`

- [ ] **Step 1: Create `YouTubeFallback.vue`**
- YouTube IFrame embed (min 200x200 per ToS)
- Only shown when song has no `animethemes_slug` but has `youtube_id`
- Minimal styling: rounded corners, same panel area as video player

- [ ] **Step 2: Update DetailPanel** — conditionally render VideoPlayer vs YouTubeFallback vs ExternalLinkCard based on available sources

- [ ] **Step 3: Create external link card** — beautiful card with album art + "Listen on" buttons when no playable source exists

- [ ] **Step 4: Verify** — songs without AnimeThemes show YouTube or link card

- [ ] **Step 5: Commit**

```bash
git add src/components/player/ src/composables/ && git commit -S -m "feat: add YouTube fallback player and external link card"
```

---

## Phase 4: Community Features

> Add auth, voting, trivia, comments, and search. End result: users can log in, vote, comment, and search.

### Task 4.1: Authentication UI

**Files:**

- Create: `src/components/ui/AuthButton.vue`
- Create: `src/components/ui/UserMenu.vue`
- Modify: `src/stores/auth.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: Implement auth store actions** — `signInWithGoogle()`, `signInWithGithub()`, `signOut()`, `onAuthStateChange()` listener

- [ ] **Step 2: Create `AuthButton.vue`** — "Sign in" button (top-right), opens dropdown with Google/GitHub options

- [ ] **Step 3: Create `UserMenu.vue`** — shows avatar + nickname when logged in, dropdown with "Sign out"

- [ ] **Step 4: Wire to App.vue** — show AuthButton or UserMenu based on auth state

- [ ] **Step 5: Verify** — Google/GitHub OAuth login works, user info persists on refresh

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ src/stores/auth.ts src/App.vue && git commit -S -m "feat: add Google/GitHub OAuth authentication"
```

---

### Task 4.2: Iconic Vote System

**Files:**

- Create: `src/components/community/VoteButton.vue`
- Create: `src/composables/useVote.ts`
- Modify: `src/components/player/DetailPanel.vue`

- [ ] **Step 1: Create `useVote.ts`** — composable:
- `toggleVote(songId)` — insert or delete from votes table
- `hasVoted(songId)` — check if current user voted
- Subscribe to Supabase Realtime for vote_count changes
- Optimistic UI update

- [ ] **Step 2: Create `VoteButton.vue`**
- Star icon (⭐), filled when voted, outline when not
- Vote count displayed next to it
- Gold glow animation on vote
- Disabled state when not authenticated (tooltip "Sign in to vote")

- [ ] **Step 3: Add to DetailPanel**

- [ ] **Step 4: Verify** — vote toggles, count updates in realtime, star size on galaxy changes

- [ ] **Step 5: Commit**

```bash
git add src/components/community/VoteButton.vue src/composables/useVote.ts src/components/player/DetailPanel.vue && git commit -S -m "feat: add iconic vote system with realtime updates"
```

---

### Task 4.3: Trivia Section

**Files:**

- Create: `src/components/community/TriviaSection.vue`
- Create: `src/composables/useTrivia.ts`
- Modify: `src/components/player/DetailPanel.vue`

- [ ] **Step 1: Create `useTrivia.ts`**
- `fetchTrivia(songId)` — get top 3 approved trivia
- `submitTrivia(songId, content)` — insert (max 500 chars)
- `upvoteTrivia(triviaId)` — insert into trivia_upvotes
- `reportTrivia(triviaId)` — increment report_count

- [ ] **Step 2: Create `TriviaSection.vue`**
- "Did you know?" header
- List of top 3 trivia items with upvote count + upvote button
- "Add trivia" input (shown when authenticated)
- Report button (subtle, on hover)

- [ ] \*\*Step 3: Add to DetailPanel below video/song info

- [ ] **Step 4: Verify** — trivia displays, submit works, upvote count updates

- [ ] **Step 5: Commit**

```bash
git add src/components/community/ src/composables/useTrivia.ts src/components/player/DetailPanel.vue && git commit -S -m "feat: add trivia section with upvote and report"
```

---

### Task 4.4: Comments Section

**Files:**

- Create: `src/components/community/CommentList.vue`
- Create: `src/composables/useComments.ts`
- Modify: `src/components/player/DetailPanel.vue`

- [ ] **Step 1: Create `useComments.ts`**
- `fetchComments(songId, page)` — paginated, 5 per page, newest first
- `addComment(songId, content)` — insert (max 280 chars)
- `deleteComment(commentId)` — delete own
- `reportComment(commentId)` — increment report_count

- [ ] **Step 2: Create `CommentList.vue`**
- List of comments: avatar + nickname + content + timestamp
- "Load more" button for pagination
- Add comment input (shown when authenticated)
- Delete button on own comments
- Report button (subtle)

- [ ] \*\*Step 3: Add to DetailPanel below trivia

- [ ] **Step 4: Verify** — comments CRUD works, pagination loads more

- [ ] **Step 5: Commit**

```bash
git add src/components/community/ src/composables/useComments.ts src/components/player/DetailPanel.vue && git commit -S -m "feat: add comments section with pagination and report"
```

---

### Task 4.5: Search

**Files:**

- Create: `src/components/navigation/SearchBar.vue`
- Modify: `src/stores/songs.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: Update songs store** — add `searchSongs(query)` action using Supabase ilike across songs title, artists name, animes title (joined query)

- [ ] **Step 2: Create `SearchBar.vue`**
- Top-left, collapsible (click icon to expand input)
- Debounced input (300ms)
- Results dropdown grouped by: Songs / Artists / Anime
- Click song → camera flies to star + opens detail panel
- Click artist → camera zooms to show constellation
- Keyboard shortcut: `/` to focus
- Escape to close

- [ ] **Step 3: Wire to App.vue**

- [ ] **Step 4: Verify** — search finds songs/artists/anime, selecting navigates galaxy

- [ ] **Step 5: Commit**

```bash
git add src/components/navigation/SearchBar.vue src/stores/songs.ts src/App.vue && git commit -S -m "feat: add search with grouped results and galaxy navigation"
```

---

## Phase 5: Constellation Lines & Era Summary

> Visual polish features that connect the galaxy experience.

### Task 5.1: Artist Constellation Lines

**Files:**

- Create: `src/components/galaxy/ConstellationLines.vue`
- Modify: `src/stores/galaxy.ts`

- [ ] **Step 1: Update galaxy store** — compute constellation data:
- Group stars by artist_id
- For each artist with 2+ songs: store ordered list of star positions

- [ ] **Step 2: Create `ConstellationLines.vue`**
- Three.js LineSegments connecting stars of same artist
- Only visible at mid/close zoom (LOD)
- Default: hidden. On hover of any star → show that artist's constellation
- Faint line, genre-colored, slight glow
- "View artist constellation" button in DetailPanel → highlight + camera zoom to fit all artist stars

- [ ] **Step 3: Verify** — hover star → constellation appears, button zooms to fit

- [ ] **Step 4: Commit**

```bash
git add src/components/galaxy/ConstellationLines.vue src/stores/galaxy.ts && git commit -S -m "feat: add artist constellation lines with hover reveal"
```

---

### Task 5.2: Era Summary Overlay

**Files:**

- Create: `src/components/navigation/EraSummary.vue`
- Modify: `src/stores/galaxy.ts`

- [ ] **Step 1: Compute era stats in galaxy store**
- Per decade: song count, top artist (most songs), most iconic song (highest vote_count)

- [ ] **Step 2: Create `EraSummary.vue`**
- Semi-transparent overlay shown at mid-zoom (era level)
- Displays: era name, decade, song count, top artist, most iconic song
- Fade in/out with zoom level
- Click "most iconic" → navigate to that star

- [ ] **Step 3: Verify** — zoom to era level → summary appears with correct stats

- [ ] **Step 4: Commit**

```bash
git add src/components/navigation/EraSummary.vue src/stores/galaxy.ts && git commit -S -m "feat: add era summary overlay with stats"
```

---

## Phase 6: Visual Polish & Animations

> Make it feel magical. Star animations, playing effects, camera transitions.

### Task 6.1: Playing Star Effects

**Files:**

- Modify: `src/components/galaxy/StarField.vue`
- Create: `src/components/galaxy/RippleEffect.vue`

- [ ] **Step 1: Add ripple animation** — when a star is playing:
- Concentric rings expanding outward from the star (custom shader or animated sprites)
- Color matches genre
- Nearby stars pulse gently in response

- [ ] **Step 2: Add "active star" glow** — brighter, larger, distinct from hover

- [ ] **Step 3: Verify** — playing star clearly stands out with ripple + glow

- [ ] **Step 4: Commit**

```bash
git add src/components/galaxy/ && git commit -S -m "feat: add playing star ripple effect and active glow"
```

---

### Task 6.2: Camera Trail Effect

**Files:**

- Modify: `src/stores/galaxy.ts`
- Modify: `src/components/galaxy/StarField.vue`

- [ ] **Step 1: Implement camera trail** — when camera auto-pans to next song:
- Stars along the path briefly brighten as camera passes
- Fades back to normal after camera moves on
- Creates a "comet trail" effect through the galaxy

- [ ] **Step 2: Verify** — auto-play transition shows trail through stars

- [ ] **Step 3: Commit**

```bash
git add src/stores/galaxy.ts src/components/galaxy/StarField.vue && git commit -S -m "feat: add camera trail effect during auto-play transitions"
```

---

### Task 6.3: Loading & Onboarding

**Files:**

- Create: `src/components/ui/LoadingScreen.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Create `LoadingScreen.vue`**
- Animated spiral star icon (spinning)
- "Yozora.fm" logotype fades in
- Tagline: "Every song is a star. Tune in to the night sky of your memories."
- Progress bar for data loading
- Once loaded: screen fades out, galaxy zooms in from far

- [ ] **Step 2: Add brief onboarding hint** — first visit tooltip: "Scroll to zoom, drag to pan, click a star to listen"

- [ ] **Step 3: Verify** — smooth load → onboard → galaxy reveal

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/LoadingScreen.vue src/App.vue && git commit -S -m "feat: add loading screen with animated logo and onboarding"
```

---

## Phase 7: Spotify Integration (Optional Upgrade)

> Add Spotify Web Playback SDK as an optional audio mode.

### Task 7.1: Spotify OAuth + Web Playback

**Files:**

- Create: `src/composables/useSpotify.ts`
- Create: `src/components/player/SpotifyPlayer.vue`
- Modify: `src/components/player/DetailPanel.vue`
- Modify: `src/stores/auth.ts`

- [ ] **Step 1: Create `useSpotify.ts`**
- Spotify OAuth flow via Supabase Auth (add Spotify as provider) or standalone PKCE flow
- Initialize Spotify Web Playback SDK
- `play(spotifyUri)`, `pause()`, `setVolume()`
- Get audio analysis data for visualizations

- [ ] **Step 2: Create `SpotifyPlayer.vue`**
- Replaces video area when in "Audio mode"
- Album art centered, waveform ring visualization, particles reacting to audio
- Uses Canvas 2D or WebGL for visualizations

- [ ] **Step 3: Add mode toggle in DetailPanel** — "Video mode" / "Audio mode" switch

- [ ] **Step 4: Add "Connect Spotify" button** in a settings dropdown

- [ ] **Step 5: Handle fallback** — song not on Spotify → auto-switch to AnimeThemes with toast

- [ ] **Step 6: Verify** — Spotify login → audio plays → visualization renders → fallback works

- [ ] **Step 7: Commit**

```bash
git add src/composables/useSpotify.ts src/components/player/ src/stores/auth.ts && git commit -S -m "feat: add Spotify Web Playback SDK with audio visualization mode"
```

---

## Phase 8: Deploy

> Ship it. (Git + GitHub already initialized in Phase 0)

### Task 8.1: Vercel Deployment

- [ ] **Step 1: Connect Vercel to GitHub repo**
- [ ] **Step 2: Set environment variables** — VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- [ ] **Step 3: Deploy + verify live URL**
- [ ] **Step 4: Add live URL to GitHub repo description**

---

### Task 8.2: Supabase Edge Function — Weekly Sync

**Files:**

- Create: `supabase/functions/weekly-sync/index.ts`

- [ ] **Step 1: Create edge function** — checks AnimeThemes for new seasonal themes, enriches with AniList, upserts to DB
- [ ] **Step 2: Deploy via Supabase MCP**
- [ ] **Step 3: Set up weekly cron trigger**
- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ && git commit -S -m "feat: add weekly sync edge function for new anime themes"
```

---

## Phase 4.5: Icon Package + VueUse Cleanup

> Replace all hardcoded SVG icons with an icon package. Maximize @vueuse/core usage.

### Task 4.5a: Install Icon Package + Replace Hardcoded SVGs

**Files:**

- Modify: `package.json`
- Modify: All components with hardcoded SVGs (SearchBar, VideoPlayer, AuthButton, UserMenu, VoteButton, DetailPanel, PipPlayer, etc.)

- [ ] **Step 1: Install `lucide-vue-next`** (lightweight, tree-shakeable icon library)

```bash
npm install lucide-vue-next
```

- [ ] **Step 2: Audit all components for hardcoded SVGs** — grep for `<svg` and `<path` across `src/components/`

- [ ] **Step 3: Replace all hardcoded SVGs** with Lucide icons:
- Search icon → `<Search />`
- Close/X icon → `<X />`
- Play/Pause → `<Play />`, `<Pause />`
- Volume → `<Volume2 />`, `<VolumeX />`
- Fullscreen → `<Maximize />`, `<Minimize />`
- Star/Vote → `<Star />`
- Expand → `<Maximize2 />`
- Report/Flag → `<Flag />`
- Trash/Delete → `<Trash2 />`
- ChevronDown → `<ChevronDown />`
- User → `<User />`
- ThumbsUp → `<ThumbsUp />`
- Lightbulb → `<Lightbulb />`

- [ ] **Step 4: Refactor VueUse usage** — replace manual implementations with:
- `useTimeAgo` for comment timestamps
- `useIntersectionObserver` for lazy loading
- `useClipboard` if copy functionality exists
- `onClickOutside` for dropdown close (AuthButton, UserMenu)
- `useLocalStorage` for persistent preferences (replace manual localStorage)

- [ ] **Step 5: Verify build**
- [ ] **Step 6: Commit**

```bash
git add -A && git commit -S -m "refactor: replace hardcoded SVGs with lucide-vue-next, optimize VueUse usage"
```

---

## Phase Summary

| Phase                | Scope                                                        | Dependency  |
| -------------------- | ------------------------------------------------------------ | ----------- |
| **0. Git Init**      | Git repo, GitHub, .gitignore                                 | None        |
| **1. Foundation**    | Project setup, DB, seed data, stores, realtime               | Phase 0     |
| **2. Galaxy**        | 3D spiral, stars, interaction, LOD, navigation               | Phase 1     |
| **3. Player**        | Detail panel, video player, PiP, auto-play, YouTube fallback | Phase 2     |
| **4. Community**     | Auth, votes, trivia, comments, search                        | Phase 1 + 3 |
| **4.5 Cleanup**      | Icon package, VueUse optimization                            | Phase 4     |
| **5. Constellation** | Artist lines, era summary                                    | Phase 2     |
| **6. Polish**        | Animations, effects, loading screen                          | Phase 2 + 3 |
| **7. Spotify**       | Optional audio mode                                          | Phase 3     |
| **8. Deploy**        | Vercel, edge function                                        | All         |

Each phase produces a working, testable increment. Phase 0-3 = core experience. Phase 4-6 = community + polish. Phase 7-8 = extras + ship.
