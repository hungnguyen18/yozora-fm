# Changelog

All notable changes to Yozora.fm are documented here.

## [Unreleased]

### Added

- **Constellation Focus Mode** — Click "View artist constellation" in the detail panel to fly camera to all of an artist's stars, keep constellation lines visible, and dim non-artist stars (`7b15090`)
- **Genre Filter** — Click any genre in the legend to highlight matching stars and dim others to 20%. Click again to clear. Composes with constellation focus (`bfc9054`)
- **Session Trail** — A glowing white-blue line connects every star you've played this session, fading from bright (newest) to transparent (oldest) (`42a73e8`)
- **CLAUDE.md** — Project architecture documentation for AI-assisted development (`0aab728`)

### Fixed

- **Star position offset** — All layout code now uses identical jitter parameters (±25° angle, ±15% radius). Previously, `computeSinglePosition`, `Minimap`, and store used different values, causing flyToStar, ripple, and constellation lines to target wrong positions (`872031d`)
- **Double-play on star click** — Removed duplicate `playAudio()` call that caused competing video loads and crossfades (`bc14615`)
- **Scale cap overwriting highlights** — Zoom changes no longer reset hover/active star scale. Hover and active multipliers are preserved through `applyScaleCap` (`bc14615`)
- **Trail reverting active star color** — Camera trail fade no longer overwrites the playing star's white highlight back to genre color (`bc14615`)
- **Dead code cleanup** — Removed unused `computeStarPositions`, `eraStats` getter, and associated constants from galaxy store. Simplified `IStarPosition` to `{x, y, songId}` (`872031d`)
- **listRecentId reactivity** — Changed from plain array to `ref<number[]>` so watchers and computed properties can track changes (`d98fd93`)
- **Session trail rendering** — Bake alpha into RGB brightness (LineBasicMaterial ignores vertex alpha), use O(1) Map lookup and resolved count for correct gradient (`d98fd93`)
- **Focus zoom clipping** — Constellation focus zoom now subtracts 520px panel width from viewport calculation (`d98fd93`)
