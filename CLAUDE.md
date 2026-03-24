# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Yozora.fm

An interactive anime music galaxy visualizer. Songs are rendered as stars in a spiral galaxy (Three.js via TresJS), color-coded by genre, arranged by year (older = outer rim, newer = center). Users click stars to play anime OP/ED videos. Backend is Supabase (Postgres + Auth).

## Commands

- `yarn dev` — Vite dev server
- `yarn build` — Type-check (`vue-tsc -b`) then Vite production build
- `yarn preview` — Preview production build locally
- `yarn seed` — Seed Supabase DB from AnimeThemes/AniList/Spotify APIs
- `yarn enrich:genres` — Multi-signal genre classifier (AniList + artist patterns + song type)

No test runner or linter is configured.

## CI/CD

- **GitHub Actions** — `.github/workflows/version-bump.yml`: on push to `main`, bumps patch version, categorizes commits into CHANGELOG, tags and pushes with `[skip ci]`
- **Vercel** — Auto-deploys from `main` branch
- **Branch**: `main` (default)

## Environment

Requires `.env` or `.env.local` with:

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key

## Architecture

**Stack**: Vue 3 (Composition API, `<script setup>`), Pinia stores, Three.js via TresJS (`@tresjs/core`), Tailwind CSS v4, Vite 8, TypeScript, Yarn 4. No router library — uses History API directly.

**Path alias**: `@` → `src/`

### Stores (Pinia) — `src/stores/`

- **songs** — Fetches all songs from Supabase with artist/anime joins. Paginates past the 1000-row limit. Client-side search over the loaded list.
- **galaxy** — Star positions (Archimedean spiral layout), camera state (zoom/pan/LOD tier), constellation data (artists with 2+ songs), flyToStar/flyToEra animation, focusArtist (constellation focus mode), genre highlighting, trail effects.
- **player** — Playback state, current song, volume/autoPlay (persisted via `useLocalStorage`). `next()` supports 3 modes: artist radio (focused artist's songs chronologically), season traversal (same anime season), era traversal (nearest star in same decade). Avoids recently played songs.
- **auth** — Supabase OAuth (Google/GitHub), session restore via `onAuthStateChange`.

### Composables — `src/composables/`

- **usePlayer** — Singleton dual-video crossfade system. Two `<video>` elements (A/B) live in a hidden container; `VideoPlayer.vue` adopts them on mount. Handles play, crossfade, volume, progress tracking, and background-tab safety polling.
- **useGalaxyLayout** — Computes instanced mesh buffers (matrices, colors, sizes) for the star field. Spiral layout: year → angle/radius, genre → arm offset (4 arms × 90°), seeded jitter per song ID (mulberry32 PRNG).
- **useStarInteraction** — Mouse hover/click hit detection using spatial grid index. Projects star positions to screen space, throttled to ~30fps.
- **useStarSpatialIndex** — Grid-based spatial index for fast nearest-star queries.
- **useRouting** — History API routing: `/` (galaxy) and `/song/:id` (detail panel). No vue-router.
- **useLOD** — Level-of-detail tier management (far/mid/close) based on zoom.
- **useRealtime** — Supabase realtime subscriptions.
- **useVote / useComments / useTrivia** — Community feature interactions via Supabase.
- **useKeyboardNav** — Keyboard shortcuts (H = toggle UI, space = play/pause, etc).
- **useDiscovery** — Tracks first-play discoveries in localStorage, triggers golden burst animation.
- **useRelatedSongs** — Scores related songs by artist/genre/year proximity, returns top 5.
- **useExplorerPassport** — 50x50 fog-of-war grid tracking camera exploration, persisted to localStorage.

### Components — `src/components/`

- **galaxy/** — `GalaxyScene.vue` (TresJS canvas + OrthographicCamera), `StarField.vue` (InstancedMesh rendering with GLSL shaders for OP/ED star shapes, discovery burst, playback pulse), `CameraController.vue` (zoom/pan), `ConstellationLines.vue`, `SessionTrail.vue` (glowing line connecting played stars), `Nebula.vue`, `ParticleDust.vue`, `DecadeRings.vue`, `RippleEffect.vue`.
- **player/** — `DetailPanel.vue` (song info sidebar, 520px), `VideoPlayer.vue` (adopts singleton videos from usePlayer), `PipPlayer.vue` (picture-in-picture mini player), `YouTubeFallback.vue`, `ExternalLinkCard.vue`.
- **navigation/** — `SearchBar.vue`, `Minimap.vue`, `GenreLegend.vue`, `RandomPlayButton.vue`, `EraIndicator.vue`, `EraSummary.vue`.
- **ui/** — `AuthButton.vue`, `UserMenu.vue`, `LoadingScreen.vue`, `DiscoveryCounter.vue` (discovered count + explored %).
- **community/** — `VoteButton.vue`, `CommentList.vue`, `TriviaSection.vue`.

### Key Patterns

- **Galaxy layout is deterministic**: Same song ID always maps to same position (seeded PRNG, mulberry32). Jitter: ±25° angle, ±15% radius — must be identical everywhere (store, composable, minimap).
- **OP/ED star shapes**: Per-instance `aType` attribute on InstancedMesh. OPs render rounder, EDs spikier via GLSL shader mix.
- **Video playback is singleton**: `usePlayer` creates exactly two `<video>` elements shared across the entire app. Components mount/unmount them into their DOM containers but never create new ones.
- **Songs loaded eagerly**: All songs are fetched on app mount and kept in memory. Search is client-side over the full list.
- **Video source**: AnimeThemes CDN (`v.animethemes.moe/{slug}`). Songs without `animethemes_slug` can't be played.
- **TresJS custom elements**: Vue warns about unresolved `Tres*` / `primitive` components — suppressed in `main.ts` via `warnHandler`.

### DB Tables (Supabase)

`songs`, `artists`, `animes` (core data), `votes`, `trivia`, `comments`, `trivia_upvotes` (community features). Songs join to artists and animes via `artist_id` and `anime_id`.

### Seed Scripts — `scripts/seed/`

Pipeline: AnimeThemes API → AniList enrichment → Spotify metadata → Supabase upsert. Also `scripts/enrich-covers.ts` for album art and `scripts/enrich-genres.ts` for multi-signal genre classification (AniList genres/tags, anime correlation, artist patterns, song type bias).
