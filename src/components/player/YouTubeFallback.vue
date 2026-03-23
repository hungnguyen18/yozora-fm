<script setup lang="ts">
type TYouTubeFallbackProps = {
  youtubeId: string;
};

defineProps<TYouTubeFallbackProps>();
</script>

<template>
  <div class="youtube-container">
    <iframe
      :src="`https://www.youtube.com/embed/${youtubeId}?autoplay=1`"
      frameborder="0"
      allow="autoplay; encrypted-media"
      allowfullscreen
      class="youtube-iframe"
      title="YouTube video player"
    />
  </div>
</template>

<style scoped>
.youtube-container {
  width: 100%;
  aspect-ratio: 16 / 9;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  background-color: #0a0b1a;
  position: relative;
}

.youtube-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 12px;
  min-width: 200px;
  min-height: 200px;
}
</style>
