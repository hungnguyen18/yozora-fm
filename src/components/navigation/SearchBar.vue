<script setup lang="ts">
import { ref, watch } from 'vue';
import { useEventListener } from '@vueuse/core';
import { Search, X, Music, User, Tv } from 'lucide-vue-next';
import { useSongsStore } from '@/stores/songs';
import { useGalaxyStore } from '@/stores/galaxy';
import { usePlayerStore } from '@/stores/player';
import type { ISong } from '@/types';

const songsStore = useSongsStore();
const galaxyStore = useGalaxyStore();
const playerStore = usePlayerStore();

const isExpanded = ref(false);
const query = ref('');
const listResult = ref<ISong[]>([]);
const inputRef = ref<HTMLInputElement | null>(null);

// Reactive search — runs immediately when query changes.
// searchSongs is synchronous (in-memory filter), so no debounce needed.
watch(query, (q) => {
  const trimmed = q.trim();
  if (trimmed.length < 2) {
    listResult.value = [];
    return;
  }
  listResult.value = songsStore.searchSongs(trimmed);
});

watch(isExpanded, (val) => {
  if (val) {
    // Focus the input after the DOM updates
    setTimeout(() => inputRef.value?.focus(), 50);
  }
});

// Derive grouped results from the flat ISong list
const uniqueArtists = (): string[] => {
  const seen = new Set<string>();
  const listArtist: string[] = [];
  for (let i = 0; i < listResult.value.length; i += 1) {
    const name = listResult.value[i].artist?.name;
    if (name && !seen.has(name)) {
      seen.add(name);
      listArtist.push(name);
    }
  }
  return listArtist;
};

const uniqueAnime = (): string[] => {
  const seen = new Set<string>();
  const listAnime: string[] = [];
  for (let i = 0; i < listResult.value.length; i += 1) {
    const title = listResult.value[i].anime?.title;
    if (title && !seen.has(title)) {
      seen.add(title);
      listAnime.push(title);
    }
  }
  return listAnime;
};

const onSelectSong = (song: ISong) => {
  playerStore.play(song);
  galaxyStore.selectedSongId = song.id;
  galaxyStore.flyToStar(song.id);
  close();
};

const close = () => {
  isExpanded.value = false;
  query.value = '';
  listResult.value = [];
};

const isInsideEditable = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
};

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === '/' && !isExpanded.value && !isInsideEditable(e.target)) {
    e.preventDefault();
    isExpanded.value = true;
  }
  if (e.key === 'Escape') {
    close();
  }
};

useEventListener(window, 'keydown', onKeyDown);
</script>

<template>
  <div class="search-bar-root">
    <!-- Collapsed: compact pill button -->
    <Transition name="search-toggle">
      <button
        v-if="!isExpanded"
        class="search-trigger"
        aria-label="Open search"
        @click="isExpanded = true"
      >
        <Search :size="16" />
        <span class="search-trigger-label">Search</span>
        <kbd class="search-kbd">/</kbd>
      </button>
    </Transition>

    <!-- Expanded: input + results overlay -->
    <Transition name="search-expand">
      <div v-if="isExpanded" class="search-overlay">
        <!-- Backdrop: click to close -->
        <div class="search-backdrop" @click="close" />

        <div class="search-panel">
          <div class="search-input-row">
            <Search :size="18" class="text-muted-lavender shrink-0" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="search-input"
              placeholder="Search songs, artists, anime..."
              @keydown.escape="close"
            />
            <button
              class="search-close-btn"
              aria-label="Close search"
              @click="close"
            >
              <X :size="16" />
            </button>
          </div>

          <!-- Results dropdown -->
          <div
            v-if="listResult.length > 0"
            class="search-results"
          >
            <!-- Songs group -->
            <div v-if="listResult.length > 0">
              <div class="search-group-header">
                <Music :size="12" class="text-primary-light" />
                <span>Songs</span>
              </div>
              <div
                v-for="song in listResult.slice(0, 8)"
                :key="song.id"
                class="search-result-item"
                @click="onSelectSong(song)"
              >
                <p class="search-result-title">{{ song.title }}</p>
                <p class="search-result-meta">
                  {{ song.artist?.name }}
                  <span v-if="song.anime?.title"> · {{ song.anime.title }}</span>
                </p>
              </div>
            </div>

            <!-- Artists group -->
            <div v-if="uniqueArtists().length > 0">
              <div class="search-group-header">
                <User :size="12" class="text-secondary" />
                <span>Artists</span>
              </div>
              <div
                v-for="artistName in uniqueArtists().slice(0, 4)"
                :key="artistName"
                class="search-result-item"
                @click="onSelectSong(listResult.find((s) => s.artist?.name === artistName)!)"
              >
                <p class="search-result-title">{{ artistName }}</p>
              </div>
            </div>

            <!-- Anime group -->
            <div v-if="uniqueAnime().length > 0">
              <div class="search-group-header">
                <Tv :size="12" class="text-accent" />
                <span>Anime</span>
              </div>
              <div
                v-for="animeTitle in uniqueAnime().slice(0, 4)"
                :key="animeTitle"
                class="search-result-item"
                @click="onSelectSong(listResult.find((s) => s.anime?.title === animeTitle)!)"
              >
                <p class="search-result-title">{{ animeTitle }}</p>
              </div>
            </div>
          </div>

          <!-- No results state -->
          <div
            v-if="listResult.length === 0 && query.trim().length >= 2"
            class="search-no-results"
          >
            No results for "{{ query }}"
          </div>

          <!-- Empty state hint -->
          <div
            v-if="listResult.length === 0 && query.length === 0"
            class="search-hint"
          >
            Type at least 2 characters to search
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.search-bar-root {
  position: fixed;
  top: 1rem;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 60;
}

.search-bar-root > * {
  pointer-events: auto;
}

/* --- Collapsed trigger button --- */
.search-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(20, 21, 41, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(79, 70, 229, 0.25);
  border-radius: 9999px;
  color: #9b9bb4;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.search-trigger:hover {
  border-color: rgba(79, 70, 229, 0.5);
  color: #e8e8f0;
  background: rgba(20, 21, 41, 0.9);
}

.search-trigger-label {
  pointer-events: none;
}

.search-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.3rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.25rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem;
  color: #9b9bb4;
  line-height: 1;
}

/* --- Expanded overlay --- */
.search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 60;
  display: flex;
  justify-content: center;
  padding-top: 5rem;
}

.search-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(10, 11, 26, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.search-panel {
  position: relative;
  width: 28rem;
  max-width: calc(100vw - 2rem);
  display: flex;
  flex-direction: column;
  background: rgba(20, 21, 41, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(79, 70, 229, 0.3);
  border-radius: 0.75rem;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.3),
    0 8px 40px rgba(0, 0, 0, 0.5),
    0 0 80px rgba(79, 70, 229, 0.08);
  overflow-y: auto;
  max-height: calc(100vh - 8rem);
}

.search-input-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e8e8f0;
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.search-input::placeholder {
  color: #9b9bb4;
}

.search-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 0.375rem;
  background: none;
  border: none;
  color: #9b9bb4;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.search-close-btn:hover {
  color: #e8e8f0;
  background: rgba(255, 255, 255, 0.06);
}

/* --- Results --- */
.search-results {
  overflow-y: auto;
  max-height: 24rem;
  padding-bottom: 0.5rem;
}

.search-group-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 1rem 0.375rem;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.6875rem;
  font-weight: 500;
  color: #9b9bb4;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.search-result-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.search-result-item:hover {
  background: rgba(79, 70, 229, 0.12);
}

.search-result-title {
  font-size: 0.875rem;
  color: #e8e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result-meta {
  font-size: 0.75rem;
  color: #9b9bb4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 0.125rem;
}

.search-no-results {
  padding: 1.5rem 1rem;
  font-size: 0.8125rem;
  color: #9b9bb4;
  text-align: center;
}

.search-hint {
  padding: 1rem;
  font-size: 0.8125rem;
  color: #9b9bb4;
  text-align: center;
}

/* --- Transitions --- */
.search-toggle-enter-active,
.search-toggle-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.search-toggle-enter-from,
.search-toggle-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.search-expand-enter-active {
  transition: opacity 0.2s ease;
}

.search-expand-leave-active {
  transition: opacity 0.15s ease;
}

.search-expand-enter-from,
.search-expand-leave-to {
  opacity: 0;
}
</style>
