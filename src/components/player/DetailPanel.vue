<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { useGalaxyStore } from '@/stores/galaxy';
import { useSongsStore } from '@/stores/songs';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre, ISong } from '@/types';
import { X, Orbit, ChevronRight, Share2, Check, SkipForward, Sparkles } from 'lucide-vue-next';
import { useRelatedSongs } from '@/composables/useRelatedSongs';
import VideoPlayer from '@/components/player/VideoPlayer.vue';
import YouTubeFallback from '@/components/player/YouTubeFallback.vue';
import ExternalLinkCard from '@/components/player/ExternalLinkCard.vue';
import VoteButton from '@/components/community/VoteButton.vue';
import TriviaSection from '@/components/community/TriviaSection.vue';
import CommentList from '@/components/community/CommentList.vue';

const playerStore = usePlayerStore();
const galaxyStore = useGalaxyStore();
const songsStore = useSongsStore();

const song = computed(() => playerStore.currentSong);

// Related songs scoring
const { listRelated } = useRelatedSongs(
  () => playerStore.currentSong,
  () => songsStore.listSong,
);

const songRelatedSelect = (relatedSong: ISong) => {
  galaxyStore.flyToStar(relatedSong.id);
  playerStore.play(relatedSong);
};

const songRelatedGenreColor = (genre?: string) => {
  return GENRE_COLOR_MAP[(genre as TGenre) ?? 'other'] ?? GENRE_COLOR_MAP.other;
};
const isOpen = computed(() => galaxyStore.selectedSongId !== null && song.value !== null);

// Track song ID for transition keying
const songTransitionKey = computed(() => song.value?.id ?? 0);

// Hero image loading state for shimmer placeholder
const isHeroLoading = ref(true);

const onHeroImageLoad = () => {
  isHeroLoading.value = false;
};

// Reset loading state when song changes
watch(
  () => song.value?.id,
  () => {
    isHeroLoading.value = true;
  },
);

// Genre color for glow effects
const genreColor = computed(() => {
  const genre = (song.value?.genre as TGenre) || 'other';
  return GENRE_COLOR_MAP[genre] || GENRE_COLOR_MAP.other;
});

// Hero cover art: prefer anime cover, fallback to album art
const heroImageUrl = computed(() => {
  if (!song.value) {
    return null;
  }
  return song.value.anime?.cover_url ?? song.value.album_art_url ?? null;
});

// Show hero only when no video is available (video replaces hero)
const hasVideo = computed(() => Boolean(song.value?.animethemes_slug));

// Gradient placeholder when no cover art
const heroGradientStyle = computed(() => {
  const color = genreColor.value;
  return {
    background: `linear-gradient(160deg, ${color}30 0%, #0d0e22 50%, ${color}15 100%)`,
  };
});

// Sequence label e.g. "OP1", "ED2"
const sequenceBadge = computed(() => {
  if (!song.value) {
    return null;
  }
  const seq = song.value.sequence ?? 1;
  return `${song.value.type}${seq}`;
});

// Genre tags as an array
const genreTags = computed(() => {
  if (!song.value?.genre) {
    return [];
  }
  return [song.value.genre];
});

const onPanelMouseEnter = () => {
  galaxyStore.hoveredStarId = null;
};

const close = () => {
  if (playerStore.isPlaying) {
    playerStore.isPip = true;
  } else {
    playerStore.stop();
  }
  galaxyStore.selectedSongId = null;
};

const onGenreClick = (genre: string) => {
  galaxyStore.highlightedGenre = genre;
};

const onViewConstellation = () => {
  if (song.value?.artist_id) {
    galaxyStore.focusArtist(song.value.artist_id);
    // Close detail panel so the constellation is fully visible
    if (playerStore.isPlaying) {
      playerStore.isPip = true;
    } else {
      playerStore.stop();
    }
    galaxyStore.selectedSongId = null;
  }
};

// Share: copy song URL to clipboard
const isCopied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const shareSong = async () => {
  if (!song.value) {
    return;
  }
  const url = `${window.location.origin}/song/${song.value.id}`;
  try {
    await navigator.clipboard.writeText(url);
    isCopied.value = true;
    if (copyTimer) {
      clearTimeout(copyTimer);
    }
    copyTimer = setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch {
    // Fallback: select+copy
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    isCopied.value = true;
    copyTimer = setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  }
};
</script>

<template>
  <Transition name="panel-slide">
    <div
      v-if="isOpen"
      class="detail-panel"
      role="complementary"
      aria-label="Song detail"
      @mouseenter="onPanelMouseEnter"
    >
      <!-- Accent line at top — genre colored -->
      <div
        class="accent-line"
        :style="{ background: `linear-gradient(90deg, ${genreColor}00, ${genreColor}, ${genreColor}00)` }"
      />

      <!-- Close button -->
      <button
        class="close-btn"
        aria-label="Close detail panel"
        @click="close"
      >
        <X :size="16" />
      </button>

      <!-- ═══════════════════════════════════════════
           MEDIA SECTION — video OR hero, never both
           ═══════════════════════════════════════════ -->

      <!-- Video area (outside transition — persists across song changes) -->
      <div v-if="hasVideo" class="media-section">
        <VideoPlayer
          :song="song"
          :genre-color="genreColor"
        />
      </div>

      <!-- Hero image (only when NO video — replaces video area) -->
      <div v-else class="media-section media-section--hero">
        <div class="hero-area">
          <div
            v-if="heroImageUrl && isHeroLoading"
            class="hero-shimmer"
          >
            <div class="hero-shimmer__wave" />
          </div>
          <img
            v-if="heroImageUrl"
            :src="heroImageUrl"
            :alt="song?.anime?.title ?? song?.title ?? 'Cover art'"
            class="hero-image"
            :class="{ 'hero-image--loading': isHeroLoading }"
            @load="onHeroImageLoad"
          />
          <div
            v-if="!heroImageUrl"
            class="hero-gradient"
            :style="heroGradientStyle"
          >
            <div class="hero-gradient__inner">
              <div
                class="hero-gradient__orb"
                :style="{ background: `radial-gradient(circle, ${genreColor}50 0%, transparent 70%)` }"
              />
            </div>
          </div>
          <!-- YouTube fallback inside hero -->
          <div v-if="song?.youtube_id" class="hero-youtube">
            <YouTubeFallback :youtube-id="song.youtube_id" />
          </div>
          <ExternalLinkCard
            v-else-if="song && !song.youtube_id"
            :song="song"
            :genre-color="genreColor"
          />
        </div>
      </div>

      <!-- ═══════════════════════════════════════════
           SONG INFO — overlaid at bottom of media
           ═══════════════════════════════════════════ -->
      <Transition name="song-change" mode="out-in">
        <div :key="songTransitionKey" class="song-content">
          <!-- Song identity card -->
          <div v-if="song" class="song-card">
            <!-- Badges row -->
            <div class="badges-row">
              <span
                v-if="sequenceBadge"
                class="badge badge--type"
                :style="{ borderColor: `${genreColor}80`, color: genreColor }"
              >{{ sequenceBadge }}</span>

              <button
                v-for="tag in genreTags"
                :key="tag"
                class="badge badge--genre"
                :style="{
                  backgroundColor: `${GENRE_COLOR_MAP[tag as TGenre] ?? GENRE_COLOR_MAP.other}12`,
                  color: GENRE_COLOR_MAP[tag as TGenre] ?? GENRE_COLOR_MAP.other,
                  borderColor: `${GENRE_COLOR_MAP[tag as TGenre] ?? GENRE_COLOR_MAP.other}40`,
                }"
                @click="onGenreClick(tag)"
              >{{ tag }}</button>

              <span v-if="song.year" class="badge badge--year">{{ song.year }}</span>
            </div>

            <!-- Title -->
            <h2 class="song-title">{{ song.title }}</h2>
            <p v-if="song.title_jp" class="song-title-jp">{{ song.title_jp }}</p>

            <!-- Artist + Anime row -->
            <div class="song-meta">
              <span class="song-meta__artist">{{ song.artist?.name ?? `Artist #${song.artist_id}` }}</span>
              <span class="song-meta__separator">/</span>
              <span class="song-meta__anime">{{ song.anime?.title ?? `Anime #${song.anime_id}` }}</span>
            </div>
          </div>

          <!-- Action bar -->
          <div class="action-bar">
            <div class="action-bar__left">
              <VoteButton v-if="song" :song-id="song.id" />
              <button
                class="action-btn"
                aria-label="Next song"
                @click="playerStore.next(true)"
              >
                <SkipForward :size="14" fill="currentColor" />
                <span>Next</span>
              </button>
              <button
                class="action-btn"
                :class="{ 'action-btn--success': isCopied }"
                aria-label="Copy song link"
                @click="shareSong"
              >
                <Check v-if="isCopied" :size="14" />
                <Share2 v-else :size="14" />
                <span>{{ isCopied ? 'Copied!' : 'Share' }}</span>
              </button>
            </div>
            <div class="action-bar__right">
              <label class="autoplay-toggle">
                <span class="autoplay-toggle__label">Auto-play</span>
                <button
                  class="autoplay-switch"
                  :class="{ 'autoplay-switch--on': playerStore.autoPlay }"
                  role="switch"
                  :aria-checked="playerStore.autoPlay"
                  @click="playerStore.setAutoPlay(!playerStore.autoPlay)"
                >
                  <span class="autoplay-switch__thumb" />
                </button>
              </label>
            </div>
          </div>

          <!-- Artist constellation link -->
          <button class="constellation-btn" @click="onViewConstellation">
            <Orbit :size="14" />
            <span>View artist constellation</span>
            <ChevronRight :size="14" class="constellation-btn__arrow" />
          </button>

          <!-- Divider -->
          <div class="section-divider" :style="{ borderColor: `${genreColor}15` }" />

          <!-- Community section -->
          <div v-if="song" class="community-section">
            <TriviaSection :song-id="song.id" />
            <CommentList :song-id="song.id" />
          </div>

          <!-- Related Stars -->
          <div v-if="listRelated.length > 0" class="related-section">
            <div class="section-divider" :style="{ borderColor: `${genreColor}15` }" />
            <div class="related-header">
              <Sparkles :size="14" />
              <span>Related Stars</span>
            </div>
            <div class="related-list">
              <button
                v-for="related in listRelated"
                :key="related.id"
                class="related-item"
                @click="songRelatedSelect(related)"
              >
                <span
                  class="related-item__dot"
                  :style="{ backgroundColor: songRelatedGenreColor(related.genre) }"
                />
                <div class="related-item__info">
                  <span class="related-item__title">{{ related.title }}</span>
                  <span class="related-item__meta">
                    {{ related.artist?.name ?? 'Unknown' }}
                    <template v-if="related.year"> &middot; {{ related.year }}</template>
                  </span>
                </div>
                <ChevronRight :size="12" class="related-item__arrow" />
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
/* ═══════════════════════════════════════════════
   PANEL SHELL
   ═══════════════════════════════════════════════ */

.detail-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 520px;
  height: 100vh;
  background-color: #0d0e22;
  border-left: 1px solid rgba(155, 155, 180, 0.08);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  z-index: 50;
}

.accent-line {
  position: sticky;
  top: 0;
  height: 2px;
  width: 100%;
  z-index: 12;
  flex-shrink: 0;
  opacity: 0.7;
}

/* Panel slide in/out */
.panel-slide-enter-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
              opacity 0.3s ease;
}
.panel-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.2s ease;
}
.panel-slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.panel-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
.panel-slide-enter-to,
.panel-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

/* Song change transition */
.song-change-enter-active {
  transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.song-change-leave-active {
  transition: opacity 0.15s ease,
              transform 0.15s ease;
}
.song-change-enter-from {
  opacity: 0;
  transform: translateY(16px);
}
.song-change-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(13, 14, 34, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(155, 155, 180, 0.12);
  color: rgba(155, 155, 180, 0.8);
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.2s ease;
  z-index: 11;
}
.close-btn:hover {
  color: #E8E8F0;
  background: rgba(13, 14, 34, 0.9);
  border-color: rgba(155, 155, 180, 0.25);
}

.close-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

/* ═══════════════════════════════════════════════
   MEDIA SECTION — video OR hero (mutually exclusive)
   ═══════════════════════════════════════════════ */

.media-section {
  flex-shrink: 0;
  padding: 12px 16px 0;
}

.media-section--hero {
  padding: 12px 16px 0;
}

.hero-area {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  background: #0a0b1a;
}

.hero-shimmer {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: linear-gradient(160deg, #151630 0%, #0d0e22 50%, #151630 100%);
  overflow: hidden;
}

.hero-shimmer__wave {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(155, 155, 180, 0.05) 20%,
    rgba(155, 155, 180, 0.1) 50%,
    rgba(155, 155, 180, 0.05) 80%,
    transparent 100%
  );
  animation: shimmerWave 1.5s ease-in-out infinite;
}

@keyframes shimmerWave {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.5s ease;
}

.hero-image--loading {
  opacity: 0;
}

.hero-gradient {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-gradient__inner {
  position: relative;
  width: 100%;
  height: 100%;
}

.hero-gradient__orb {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  filter: blur(50px);
  animation: orbPulse 4s ease-in-out infinite;
}

@keyframes orbPulse {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
}

.hero-youtube {
  position: absolute;
  inset: 0;
  z-index: 3;
}

/* ═══════════════════════════════════════════════
   SONG CARD
   ═══════════════════════════════════════════════ */

.song-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 0 20px 32px;
}

.song-card {
  padding: 20px 0 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.badges-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border: 1px solid;
  background: transparent;
  cursor: default;
}

.badge--type {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.625rem;
  letter-spacing: 0.08em;
}

.badge--genre {
  cursor: pointer;
  transition: opacity 0.2s;
  text-transform: capitalize;
}

.badge--genre:hover {
  opacity: 0.75;
}

.badge--genre:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

.badge--year {
  color: rgba(155, 155, 180, 0.6);
  border-color: rgba(155, 155, 180, 0.15);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.625rem;
  font-weight: 500;
}

.song-title {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 1.625rem;
  font-weight: 700;
  color: #E8E8F0;
  margin: 0;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.song-title-jp {
  font-size: 0.8125rem;
  color: rgba(155, 155, 180, 0.65);
  margin: 0;
  letter-spacing: 0.02em;
}

.song-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.song-meta__artist {
  font-size: 0.9375rem;
  color: rgba(200, 200, 220, 0.9);
  font-weight: 500;
}

.song-meta__separator {
  color: rgba(155, 155, 180, 0.3);
  font-size: 0.8125rem;
}

.song-meta__anime {
  font-size: 0.8125rem;
  color: rgba(155, 155, 180, 0.7);
}

/* ═══════════════════════════════════════════════
   ACTION BAR
   ═══════════════════════════════════════════════ */

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  margin-top: 4px;
}

.action-bar__left,
.action-bar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.autoplay-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.autoplay-toggle__label {
  font-size: 0.75rem;
  color: rgba(155, 155, 180, 0.6);
  user-select: none;
}

.autoplay-switch {
  position: relative;
  width: 34px;
  height: 18px;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  padding: 0;
  background-color: rgba(155, 155, 180, 0.2);
  transition: background-color 0.2s ease;
}

.autoplay-switch--on {
  background-color: #4F46E5;
}

.autoplay-switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

.autoplay-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: #E8E8F0;
  transition: transform 0.2s ease;
  display: block;
}

.autoplay-switch--on .autoplay-switch__thumb {
  transform: translateX(16px);
}

/* ═══════════════════════════════════════════════
   CONSTELLATION LINK
   ═══════════════════════════════════════════════ */

.constellation-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: rgba(79, 70, 229, 0.06);
  border: 1px solid rgba(79, 70, 229, 0.15);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.8125rem;
  color: rgba(129, 140, 248, 0.85);
  cursor: pointer;
  transition: all 0.2s ease;
}

.constellation-btn:hover {
  color: #A5B4FC;
  border-color: rgba(129, 140, 248, 0.35);
  background-color: rgba(79, 70, 229, 0.1);
}

.constellation-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

.constellation-btn__arrow {
  margin-left: auto;
  opacity: 0.4;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.constellation-btn:hover .constellation-btn__arrow {
  transform: translateX(2px);
  opacity: 0.7;
}

/* ═══════════════════════════════════════════════
   DIVIDER + COMMUNITY
   ═══════════════════════════════════════════════ */

.section-divider {
  border-top: 1px solid;
  margin: 16px 0;
}

.community-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ═══════════════════════════════════════════════
   RELATED STARS
   ═══════════════════════════════════════════════ */

.related-section {
  margin-top: 4px;
}

.related-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(155, 155, 180, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
}

.related-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.related-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.related-item:hover {
  background: rgba(155, 155, 180, 0.06);
  border-color: rgba(155, 155, 180, 0.1);
}

.related-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

.related-item__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}

.related-item__info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.related-item__title {
  font-size: 0.8125rem;
  color: rgba(232, 232, 240, 0.9);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.related-item__meta {
  font-size: 0.6875rem;
  color: rgba(155, 155, 180, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.related-item__arrow {
  flex-shrink: 0;
  color: rgba(155, 155, 180, 0.25);
  transition: transform 0.2s ease, color 0.2s ease;
}

.related-item:hover .related-item__arrow {
  transform: translateX(2px);
  color: rgba(155, 155, 180, 0.5);
}

/* ═══════════════════════════════════════════════
   SCROLLBAR
   ═══════════════════════════════════════════════ */

.detail-panel::-webkit-scrollbar {
  width: 3px;
}

.detail-panel::-webkit-scrollbar-track {
  background: transparent;
}

.detail-panel::-webkit-scrollbar-thumb {
  background: rgba(155, 155, 180, 0.15);
  border-radius: 3px;
}

.detail-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(155, 155, 180, 0.3);
}

/* ═══════════════════════════════════════════════
   SHARE BUTTON
   ═══════════════════════════════════════════════ */

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid rgba(155, 155, 180, 0.15);
  background: transparent;
  color: rgba(155, 155, 180, 0.7);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  color: #E8E8F0;
  border-color: rgba(155, 155, 180, 0.3);
  background: rgba(155, 155, 180, 0.06);
}

.action-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

.action-btn--success {
  color: #34D399;
  border-color: rgba(52, 211, 153, 0.3);
}

/* ═══════════════════════════════════════════════
   MOBILE RESPONSIVE
   ═══════════════════════════════════════════════ */

@media (max-width: 768px) {
  .detail-panel {
    width: 100vw;
    border-left: none;
  }

  .song-title {
    font-size: 1.375rem;
  }

  .song-content {
    padding: 0 16px 24px;
  }
}

@media (max-width: 520px) {
  .media-section {
    padding: 8px 10px 0;
  }

  .action-bar {
    flex-wrap: wrap;
    gap: 10px;
  }
}
</style>
