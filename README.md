# Yozora.fm

An interactive anime music galaxy visualizer. 9,111 anime songs rendered as stars in a spiral galaxy — color-coded by genre, arranged by year (older = outer rim, newer = center). Click a star to play its OP/ED video.

**Live**: [yozora-fm.vercel.app](https://yozora-fm.vercel.app)

## Features

- **Galaxy Visualization** — Three.js InstancedMesh spiral galaxy with custom GLSL shaders (OP/ED star shapes, twinkle, discovery burst, playback pulse)
- **Constellation Focus** — View all of an artist's songs connected by constellation lines
- **Artist Radio** — Autoplay through a focused artist's discography chronologically
- **Genre Filter** — Click legend to highlight stars by genre (rock, ballad, electronic, pop, orchestral)
- **Session Trail** — Glowing line connecting played stars with fade gradient
- **First Contact Discoveries** — Golden burst animation on first play, discovery counter
- **Explorer Passport** — Fog-of-war heatmap on minimap tracking camera exploration
- **Era Time Warp** — Click decade buttons to fly camera to that era's ring
- **Season Traversal** — Navigate by anime season instead of decade
- **Related Stars** — Detail panel recommends 5 related songs by artist/genre/year proximity
- **Keyboard Navigation** — Arrow keys to pan, H to hide UI, Space to play/pause

## Tech Stack

- **Frontend**: Vue 3 (Composition API), Pinia, Three.js via TresJS, Tailwind CSS v4, TypeScript
- **Backend**: Supabase (Postgres + Auth)
- **Build**: Vite 8, Yarn 4
- **Deploy**: Vercel (auto-deploy from `main`)
- **CI**: GitHub Actions (auto version bump + changelog on push to `main`)

## Getting Started

```bash
# Install dependencies
yarn install

# Set up environment
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Start dev server
yarn dev
```

## Scripts

| Command              | Description                                   |
| -------------------- | --------------------------------------------- |
| `yarn dev`           | Vite dev server                               |
| `yarn build`         | Type-check + production build                 |
| `yarn preview`       | Preview production build                      |
| `yarn seed`          | Seed DB from AnimeThemes/AniList/Spotify APIs |
| `yarn enrich:genres` | Multi-signal genre classification             |

## Data Pipeline

```
AnimeThemes API -> AniList enrichment -> Spotify metadata -> Supabase upsert
                   (genres, JP titles)    (album art)         (9,111 songs)
```

Genre classification uses AniList genres/tags, anime genre correlation, artist name patterns, and song type bias.

## Architecture

```
src/
  stores/          # Pinia — songs, galaxy, player, auth
  composables/     # usePlayer (dual-video crossfade), useGalaxyLayout, useDiscovery, etc.
  components/
    galaxy/        # GalaxyScene, StarField (GLSL shaders), SessionTrail, ConstellationLines
    player/        # DetailPanel, VideoPlayer, PipPlayer
    navigation/    # SearchBar, Minimap, GenreLegend, EraIndicator
    ui/            # LoadingScreen, DiscoveryCounter, AuthButton
    community/     # VoteButton, CommentList, TriviaSection
  types/           # TypeScript interfaces
scripts/
  seed/            # Data pipeline (AnimeThemes + AniList + Spotify)
  enrich-genres.ts # Genre classifier
```

## License

Private project.
