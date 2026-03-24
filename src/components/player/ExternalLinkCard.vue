<script setup lang="ts">
import { computed } from 'vue';
import { Music, ExternalLink } from 'lucide-vue-next';
import type { ISong } from '@/types';

type TExternalLinkCardProps = {
  song: ISong | null;
  genreColor?: string;
};

const props = withDefaults(defineProps<TExternalLinkCardProps>(), {
  genreColor: '#4F46E5',
});

const coverImage = computed(() => {
  if (!props.song) {
    return null;
  }
  return props.song.anime?.cover_url ?? props.song.album_art_url ?? null;
});

// Gradient fallback style
const gradientStyle = computed(() => {
  const color = props.genreColor;
  return {
    background: `linear-gradient(135deg, ${color}25 0%, #0a0b1a 50%, ${color}10 100%)`,
  };
});

const spotifyUrl = computed(() => {
  if (!props.song?.spotify_uri) {
    return null;
  }
  // spotify:track:XXXX -> extract the ID after the last colon
  const parts = props.song.spotify_uri.split(':');
  const trackId = parts[parts.length - 1];
  return `https://open.spotify.com/track/${trackId}`;
});

const youtubeUrl = computed(() => {
  if (!props.song?.youtube_id) {
    return null;
  }
  return `https://www.youtube.com/watch?v=${props.song.youtube_id}`;
});

const appleMusicUrl = computed(() => {
  if (!props.song) {
    return null;
  }
  const artistName = props.song.artist?.name ?? '';
  const term = encodeURIComponent(`${props.song.title} ${artistName}`.trim());
  return `https://music.apple.com/search?term=${term}`;
});

const hasAnyLink = computed(() => {
  return spotifyUrl.value || youtubeUrl.value || appleMusicUrl.value;
});
</script>

<template>
  <div class="ext-card">
    <!-- Cover art backdrop (blurred) -->
    <div class="ext-card__backdrop">
      <img
        v-if="coverImage"
        :src="coverImage"
        :alt="''"
        class="ext-card__backdrop-img"
      />
      <div
        v-else
        class="ext-card__backdrop-gradient"
        :style="gradientStyle"
      />
    </div>

    <!-- Content overlay -->
    <div class="ext-card__content">
      <!-- Cover image or generic icon -->
      <div class="ext-card__media">
        <img
          v-if="coverImage"
          :src="coverImage"
          :alt="song?.title ?? 'Album art'"
          class="ext-card__image"
        />
        <div v-else class="ext-card__icon-wrap">
          <Music :size="32" class="ext-card__icon" />
        </div>
      </div>

      <!-- Label -->
      <p class="ext-card__label">No playback available</p>

      <!-- External link pills -->
      <div v-if="song && hasAnyLink" class="ext-card__links">
        <a
          v-if="spotifyUrl"
          :href="spotifyUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="ext-card__pill ext-card__pill--spotify"
        >
          <ExternalLink :size="12" />
          <span>Spotify</span>
        </a>

        <a
          v-if="youtubeUrl"
          :href="youtubeUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="ext-card__pill ext-card__pill--youtube"
        >
          <ExternalLink :size="12" />
          <span>YouTube</span>
        </a>

        <a
          v-if="appleMusicUrl"
          :href="appleMusicUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="ext-card__pill ext-card__pill--apple"
        >
          <ExternalLink :size="12" />
          <span>Apple Music</span>
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ext-card {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  background-color: #0a0b1a;
}

/* Blurred backdrop */
.ext-card__backdrop {
  position: absolute;
  inset: -20px;
  z-index: 0;
  overflow: hidden;
}

.ext-card__backdrop-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(6px) brightness(0.45) saturate(1.3);
  transform: scale(1.15);
}

.ext-card__backdrop-gradient {
  width: 100%;
  height: 100%;
}

/* Content overlay */
.ext-card__content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 20px;
  box-sizing: border-box;
}

.ext-card__media {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ext-card__image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ext-card__icon-wrap {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(79, 70, 229, 0.12);
  border: 1px solid rgba(79, 70, 229, 0.2);
  backdrop-filter: blur(8px);
}

.ext-card__icon {
  width: 32px;
  height: 32px;
  color: #9B9BB4;
}

.ext-card__label {
  font-size: 0.8125rem;
  color: rgba(155, 155, 180, 0.8);
  margin: 0;
  letter-spacing: 0.02em;
}

/* External link pills */
.ext-card__links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.ext-card__pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 16px;
  border-radius: 9999px;
  border: 1px solid rgba(79, 70, 229, 0.4);
  font-size: 0.75rem;
  font-weight: 500;
  color: #E8E8F0;
  text-decoration: none;
  background: rgba(79, 70, 229, 0.1);
  backdrop-filter: blur(8px);
  transition: all 0.2s ease;
  white-space: nowrap;
}

.ext-card__pill:hover {
  background: rgba(79, 70, 229, 0.2);
  border-color: #818CF8;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(79, 70, 229, 0.4);
  transform: translateY(-1px);
}

.ext-card__pill:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

.ext-card__pill--spotify:hover {
  border-color: #1DB954;
  background: rgba(29, 185, 84, 0.15);
  box-shadow: 0 0 12px rgba(29, 185, 84, 0.35);
}

.ext-card__pill--youtube:hover {
  border-color: #FF0000;
  background: rgba(255, 0, 0, 0.1);
  box-shadow: 0 0 12px rgba(255, 0, 0, 0.25);
}

.ext-card__pill--apple:hover {
  border-color: #fc3c44;
  background: rgba(252, 60, 68, 0.1);
  box-shadow: 0 0 12px rgba(252, 60, 68, 0.25);
}
</style>
