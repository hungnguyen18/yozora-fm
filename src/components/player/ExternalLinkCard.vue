<script setup lang="ts">
import { computed } from 'vue';
import type { ISong } from '@/types';

type TExternalLinkCardProps = {
  song: ISong | null;
};

const props = defineProps<TExternalLinkCardProps>();

const coverImage = computed(() => {
  if (!props.song) {
    return null;
  }
  return props.song.album_art_url ?? props.song.anime?.cover_url ?? null;
});

const spotifyUrl = computed(() => {
  if (!props.song?.spotify_uri) {
    return null;
  }
  // spotify:track:XXXX → extract the ID after the last colon
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
</script>

<template>
  <div class="ext-card">
    <!-- Cover image or generic icon -->
    <div class="ext-card__media">
      <img
        v-if="coverImage"
        :src="coverImage"
        :alt="song?.title ?? 'Album art'"
        class="ext-card__image"
      />
      <div v-else class="ext-card__icon-wrap">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="ext-card__icon"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
          />
        </svg>
      </div>
    </div>

    <!-- Label -->
    <p class="ext-card__label">No playback available</p>

    <!-- External links -->
    <div v-if="song" class="ext-card__links">
      <a
        v-if="spotifyUrl"
        :href="spotifyUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="ext-card__btn ext-card__btn--spotify"
      >
        Listen on Spotify
      </a>

      <a
        v-if="youtubeUrl"
        :href="youtubeUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="ext-card__btn ext-card__btn--youtube"
      >
        Listen on YouTube
      </a>

      <a
        v-if="appleMusicUrl"
        :href="appleMusicUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="ext-card__btn ext-card__btn--apple"
      >
        Listen on Apple Music
      </a>
    </div>
  </div>
</template>

<style scoped>
.ext-card {
  width: 100%;
  aspect-ratio: 16 / 9;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(160deg, #1a1b35 0%, #141529 60%, #0e0f22 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  box-sizing: border-box;
}

.ext-card__media {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ext-card__image {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.ext-card__icon-wrap {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(79, 70, 229, 0.12);
  border: 1px solid rgba(79, 70, 229, 0.25);
}

.ext-card__icon {
  width: 36px;
  height: 36px;
  color: #9B9BB4;
}

.ext-card__label {
  font-size: 0.8125rem;
  color: #9B9BB4;
  margin: 0;
  letter-spacing: 0.02em;
}

.ext-card__links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.ext-card__btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 14px;
  border-radius: 9999px;
  border: 1px solid #4F46E5;
  font-size: 0.75rem;
  font-weight: 500;
  color: #E8E8F0;
  text-decoration: none;
  background: transparent;
  transition: box-shadow 0.2s, border-color 0.2s, color 0.2s;
  white-space: nowrap;
}

.ext-card__btn:hover {
  box-shadow: 0 0 10px rgba(79, 70, 229, 0.55);
  border-color: #818CF8;
  color: #ffffff;
}

.ext-card__btn--spotify:hover {
  border-color: #1DB954;
  box-shadow: 0 0 10px rgba(29, 185, 84, 0.45);
}

.ext-card__btn--youtube:hover {
  border-color: #FF0000;
  box-shadow: 0 0 10px rgba(255, 0, 0, 0.35);
}

.ext-card__btn--apple:hover {
  border-color: #fc3c44;
  box-shadow: 0 0 10px rgba(252, 60, 68, 0.35);
}
</style>
