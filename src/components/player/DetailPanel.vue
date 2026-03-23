<script setup lang="ts">
import { computed } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { useGalaxyStore } from '@/stores/galaxy';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre } from '@/types';
import VideoPlayer from '@/components/player/VideoPlayer.vue';
import YouTubeFallback from '@/components/player/YouTubeFallback.vue';
import ExternalLinkCard from '@/components/player/ExternalLinkCard.vue';
import VoteButton from '@/components/community/VoteButton.vue';
import TriviaSection from '@/components/community/TriviaSection.vue';
import CommentList from '@/components/community/CommentList.vue';

const playerStore = usePlayerStore();
const galaxyStore = useGalaxyStore();

const song = computed(() => playerStore.currentSong);
const isOpen = computed(() => song.value !== null);

// Genre color for glow effects
const genreColor = computed(() => {
  const genre = (song.value?.genre as TGenre) || 'other';
  return GENRE_COLOR_MAP[genre] || GENRE_COLOR_MAP.other;
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
        ✕
      </button>

      <!-- 1. Video area — AnimeThemes WebM → YouTube fallback → external link card -->
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
      />

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
        <!-- 2. Song info -->
        <div v-if="song" class="song-info">
          <h2 class="song-info__title">{{ song.title }}</h2>
          <p v-if="song.title_jp" class="song-info__title-jp">{{ song.title_jp }}</p>
          <p class="song-info__artist">{{ song.artist?.name ?? `Artist #${song.artist_id}` }}</p>
          <p class="song-info__anime">
            {{ song.anime?.title ?? `Anime #${song.anime_id}` }}
            <span v-if="song.year" class="song-info__year">({{ song.year }})</span>
          </p>
        </div>

        <!-- 3. OP/ED badge -->
        <div v-if="sequenceBadge" class="badge-row">
          <span
            class="op-ed-badge"
            :style="{ borderColor: genreColor, color: genreColor }"
          >{{ sequenceBadge }}</span>
        </div>

        <!-- 4. Genre tags -->
        <div v-if="genreTags.length > 0" class="genre-tags">
          <button
            v-for="tag in genreTags"
            :key="tag"
            class="genre-tag"
            :style="{ backgroundColor: `${GENRE_COLOR_MAP[tag as TGenre] ?? GENRE_COLOR_MAP.other}22`, color: GENRE_COLOR_MAP[tag as TGenre] ?? GENRE_COLOR_MAP.other, borderColor: GENRE_COLOR_MAP[tag as TGenre] ?? GENRE_COLOR_MAP.other }"
            @click="onGenreClick(tag)"
          >
            {{ tag }}
          </button>
        </div>

        <!-- 5. View artist constellation -->
        <button class="constellation-btn" @click="onViewConstellation">
          View artist constellation
        </button>

        <!-- 6. Community section -->
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
  width: 400px;
  height: 100vh;
  background-color: #141529;
  border-left: 1px solid rgba(155, 155, 180, 0.15);
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
  background: transparent;
  border: none;
  color: #9B9BB4;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 4px;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #E8E8F0;
}

/* Panel body */
.panel-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Song info */
.song-info__title {
  font-size: 1.25rem; /* text-xl */
  font-weight: 700;
  color: #E8E8F0;
  margin: 0 0 4px;
  line-height: 1.3;
}

.song-info__title-jp {
  font-size: 0.875rem;
  color: #9B9BB4;
  margin: 0 0 6px;
}

.song-info__artist {
  font-size: 1.125rem; /* text-lg */
  color: #9B9BB4;
  margin: 0 0 4px;
}

.song-info__anime {
  font-size: 0.875rem; /* text-sm */
  color: #9B9BB4;
  margin: 0;
}

.song-info__year {
  opacity: 0.7;
}

/* OP/ED badge */
.badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.op-ed-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 9999px;
  border: 1px solid;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Genre tags */
.genre-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.genre-tag {
  padding: 3px 12px;
  border-radius: 9999px;
  border: 1px solid;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
  background: transparent;
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
  border: none;
  padding: 0;
  font-size: 0.875rem;
  color: #4F46E5;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.2s;
}

.constellation-btn:hover {
  color: #818CF8;
}

/* Auto-play toggle row */
.autoplay-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid rgba(155, 155, 180, 0.12);
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
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
