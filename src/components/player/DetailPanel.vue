<script setup lang="ts">
import { computed } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { useGalaxyStore } from '@/stores/galaxy';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre } from '@/types';
import { X, Orbit } from 'lucide-vue-next';
import VideoPlayer from '@/components/player/VideoPlayer.vue';
import YouTubeFallback from '@/components/player/YouTubeFallback.vue';
import ExternalLinkCard from '@/components/player/ExternalLinkCard.vue';
import VoteButton from '@/components/community/VoteButton.vue';
import TriviaSection from '@/components/community/TriviaSection.vue';
import CommentList from '@/components/community/CommentList.vue';

const playerStore = usePlayerStore();
const galaxyStore = useGalaxyStore();

const song = computed(() => playerStore.currentSong);
const isOpen = computed(() => galaxyStore.selectedSongId !== null && song.value !== null);

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

// Gradient placeholder when no cover art
const heroGradientStyle = computed(() => {
  const color = genreColor.value;
  return {
    background: `linear-gradient(160deg, ${color}30 0%, #141529 50%, ${color}15 100%)`,
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

// Genre tags as an array (song has a single genre, wrapped for uniform rendering)
const genreTags = computed(() => {
  if (!song.value?.genre) {
    return [];
  }
  return [song.value.genre];
});

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
    // Will be implemented in Phase 5
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
    >
      <!-- Close button -->
      <button
        class="close-btn"
        aria-label="Close detail panel"
        @click="close"
      >
        <X :size="18" />
      </button>

      <!-- Hero image area -->
      <div class="hero-area">
        <img
          v-if="heroImageUrl"
          :src="heroImageUrl"
          :alt="song?.anime?.title ?? song?.title ?? 'Cover art'"
          class="hero-image"
        />
        <div
          v-else
          class="hero-gradient"
          :style="heroGradientStyle"
        >
          <div class="hero-gradient__inner">
            <div
              class="hero-gradient__orb"
              :style="{ background: `radial-gradient(circle, ${genreColor}40 0%, transparent 70%)` }"
            />
          </div>
        </div>
        <div class="hero-overlay" />
      </div>

      <!-- Video area — AnimeThemes WebM / YouTube fallback / external link card -->
      <div class="video-area">
        <VideoPlayer
          v-if="song?.animethemes_slug"
          :song="song"
          :genre-color="genreColor"
        />
        <YouTubeFallback
          v-else-if="song?.youtube_id"
          :youtube-id="song.youtube_id"
        />
        <ExternalLinkCard
          v-else
          :song="song"
          :genre-color="genreColor"
        />
      </div>

      <!-- Auto-play toggle — sits between the video area and the panel body -->
      <div class="autoplay-row">
        <label class="autoplay-label" for="autoplay-toggle">Auto-play</label>
        <button
          id="autoplay-toggle"
          class="autoplay-switch"
          :class="{ 'autoplay-switch--on': playerStore.autoPlay }"
          role="switch"
          :aria-checked="playerStore.autoPlay"
          @click="playerStore.setAutoPlay(!playerStore.autoPlay)"
        >
          <span class="autoplay-switch__thumb" />
        </button>
      </div>

      <!-- Panel body -->
      <div class="panel-body">
        <!-- Song info -->
        <div v-if="song" class="song-info">
          <h2 class="song-info__title">{{ song.title }}</h2>
          <p v-if="song.title_jp" class="song-info__title-jp">{{ song.title_jp }}</p>
          <p class="song-info__artist">{{ song.artist?.name ?? `Artist #${song.artist_id}` }}</p>
          <p class="song-info__anime">
            {{ song.anime?.title ?? `Anime #${song.anime_id}` }}
            <span v-if="song.year" class="song-info__year">({{ song.year }})</span>
          </p>
        </div>

        <!-- OP/ED badge + Genre tags row -->
        <div class="meta-row">
          <span
            v-if="sequenceBadge"
            class="op-ed-badge"
            :style="{ borderColor: genreColor, color: genreColor }"
          >{{ sequenceBadge }}</span>

          <button
            v-for="tag in genreTags"
            :key="tag"
            class="genre-tag"
            :style="{
              backgroundColor: `${GENRE_COLOR_MAP[tag as TGenre] ?? GENRE_COLOR_MAP.other}15`,
              color: GENRE_COLOR_MAP[tag as TGenre] ?? GENRE_COLOR_MAP.other,
              borderColor: `${GENRE_COLOR_MAP[tag as TGenre] ?? GENRE_COLOR_MAP.other}50`,
            }"
            @click="onGenreClick(tag)"
          >
            {{ tag }}
          </button>
        </div>

        <!-- View artist constellation -->
        <button class="constellation-btn" @click="onViewConstellation">
          <Orbit :size="14" />
          <span>View artist constellation</span>
        </button>

        <!-- Community section -->
        <div v-if="song" class="community-section">
          <VoteButton :song-id="song.id" />
          <TriviaSection :song-id="song.id" />
          <CommentList :song-id="song.id" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.detail-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 480px;
  height: 100vh;
  background-color: #141529;
  border-left: 1px solid rgba(155, 155, 180, 0.12);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  z-index: 50;
}

/* Slide transition */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateX(100%);
}

.panel-slide-enter-to,
.panel-slide-leave-from {
  transform: translateX(0);
}

/* Close button */
.close-btn {
  position: absolute;
  top: 12px;
  right: 16px;
  background: rgba(20, 21, 41, 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(155, 155, 180, 0.15);
  color: #9B9BB4;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 6px 8px;
  border-radius: 8px;
  transition: color 0.2s, background-color 0.2s;
  z-index: 10;
}

.close-btn:hover {
  color: #E8E8F0;
  background: rgba(20, 21, 41, 0.85);
}

/* Hero image area */
.hero-area {
  position: relative;
  width: 100%;
  height: 200px;
  flex-shrink: 0;
  overflow: hidden;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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
  width: 180px;
  height: 180px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  filter: blur(40px);
  animation: orbPulse 4s ease-in-out infinite;
}

@keyframes orbPulse {
  0%, 100% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.15);
  }
}

.hero-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(transparent, #141529);
  pointer-events: none;
}

/* Video area */
.video-area {
  padding: 0 20px;
  margin-top: -16px;
  position: relative;
  z-index: 2;
}

/* Panel body */
.panel-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* Song info */
.song-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.song-info__title {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: #E8E8F0;
  margin: 0;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.song-info__title-jp {
  font-size: 0.875rem;
  color: #9B9BB4;
  margin: 0;
  opacity: 0.8;
}

.song-info__artist {
  font-size: 1.0625rem;
  color: #c4c4d8;
  margin: 0;
  font-weight: 500;
}

.song-info__anime {
  font-size: 0.875rem;
  color: #9B9BB4;
  margin: 0;
}

.song-info__year {
  opacity: 0.6;
}

/* Meta row — badge + genre tags inline */
.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* OP/ED badge */
.op-ed-badge {
  display: inline-block;
  padding: 3px 12px;
  border-radius: 9999px;
  border: 1px solid;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Genre tags */
.genre-tag {
  padding: 3px 12px;
  border-radius: 9999px;
  border: 1px solid;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
  background: transparent;
  text-transform: capitalize;
}

.genre-tag:hover {
  opacity: 0.75;
}

/* View constellation button */
.constellation-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid rgba(79, 70, 229, 0.25);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 0.8125rem;
  color: #818CF8;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background-color 0.2s;
  align-self: flex-start;
}

.constellation-btn:hover {
  color: #A5B4FC;
  border-color: rgba(129, 140, 248, 0.5);
  background-color: rgba(79, 70, 229, 0.08);
}

/* Auto-play toggle row */
.autoplay-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  border-bottom: 1px solid rgba(155, 155, 180, 0.1);
}

.autoplay-label {
  font-size: 0.8125rem;
  color: #9B9BB4;
  user-select: none;
}

/* Track */
.autoplay-switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  padding: 0;
  background-color: rgba(155, 155, 180, 0.25);
  transition: background-color 0.2s ease;
}

.autoplay-switch--on {
  background-color: #4F46E5;
}

/* Thumb */
.autoplay-switch__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
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

/* Community section */
.community-section {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Scrollbar styling */
.detail-panel::-webkit-scrollbar {
  width: 4px;
}

.detail-panel::-webkit-scrollbar-track {
  background: transparent;
}

.detail-panel::-webkit-scrollbar-thumb {
  background: rgba(155, 155, 180, 0.2);
  border-radius: 4px;
}

.detail-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(155, 155, 180, 0.35);
}
</style>
