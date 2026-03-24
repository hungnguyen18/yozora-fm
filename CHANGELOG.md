# Changelog

All notable changes to Yozora.fm are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/). Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Genre Classification Script** (`npm run enrich:genres`) — Multi-signal classifier using AniList genres/tags, anime genre correlation, artist name patterns, and song type bias. Assigns rock/ballad/electronic/pop/orchestral/other to all 9111 songs
- **First Contact Discoveries** — Track played songs in localStorage, golden burst animation on first play, "X / 9,111 discovered" counter
- **Related Stars** — Detail panel shows 5 related songs scored by artist, genre, year proximity
- **Session Trail** — Glowing line connecting played stars with fade gradient

### Changed

- **Seed pipeline: insert → upsert** — Artists, animes, songs now use `upsert()` with conflict resolution. Re-runs update stale data instead of failing on duplicates
- **AniList enrichment** — Now fetches `title.native` (JP titles) + 7-day cache TTL (was permanent)

### Fixed

- **Trail Set mutation** — Snapshot `activeTrailStars` before iterating to avoid undefined behavior from `Set.delete()` during `for...of`
- **applyScaleCap during flyToStar** — Skip 9111-instance matrix recalculation during camera animation, apply once when animation ends
- **listRecentId reactivity** — Changed to `ref<number[]>` for proper Vue tracking
- **Session trail rendering** — Bake alpha into RGB, O(1) position lookup
- **Focus zoom clipping** — Subtract 520px panel width from viewport

## [0.1.0] - 2026-03-24

### Added

- **Constellation Focus Mode** — Click "View artist constellation" in the detail panel to fly camera to all of an artist's stars, keep constellation lines visible, and dim non-artist stars
- **Genre Filter** — Click any genre in the legend to highlight matching stars and dim others to 20%. Click again to clear. Composes with constellation focus
- **Session Trail** — A glowing white-blue line connects every star you've played this session, fading from bright (newest) to dim (oldest)
- **First Contact Discoveries** — Track which songs you've played for the first time. Golden burst animation on discovery. "X / 9,111 discovered" counter persisted in localStorage
- **Related Stars** — Detail panel shows 5 related songs scored by artist, genre, year proximity. Click to fly + play
- **CLAUDE.md** — Project architecture documentation for AI-assisted development
- **CHANGELOG.md** — Version-tracked change history

### Fixed

- **Star position offset** — All layout code now uses identical jitter parameters (±25° angle, ±15% radius). Previously 3 different jitter values caused flyToStar, ripple, constellation lines, and minimap to target wrong positions
- **Double-play on star click** — Removed duplicate `playAudio()` call that caused competing video loads and crossfades
- **Scale cap overwriting highlights** — Zoom changes no longer reset hover/active star scale multipliers
- **Trail reverting active star color** — Camera trail fade no longer overwrites the playing star's white highlight back to genre color
- **listRecentId reactivity** — Changed from plain array to `ref<number[]>` so watchers and computed properties track changes correctly
- **Session trail rendering** — Bake alpha into RGB brightness (LineBasicMaterial ignores vertex alpha), use O(1) Map lookup for positions
- **Focus zoom clipping** — Constellation focus zoom subtracts 520px panel width from viewport calculation
- **Dead code cleanup** — Removed unused `computeStarPositions`, `eraStats` getter, and associated constants. Simplified `IStarPosition` type

### Removed

- **Mesh rotation** — Removed `mesh.rotation.z` that caused star interaction drift over time (~34° after 1 minute)
