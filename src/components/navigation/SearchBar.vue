<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useEventListener } from '@vueuse/core';
import { Search, X, Music, User, Tv } from 'lucide-vue-next';
import { useSongsStore } from '@/stores/songs';
import { useGalaxyStore } from '@/stores/galaxy';
import { usePlayerStore } from '@/stores/player';
import type { ISong } from '@/types';

type TSearchBarProps = {
  isVisible?: boolean;
};

const props = withDefaults(defineProps<TSearchBarProps>(), {
  isVisible: true,
});

const songsStore = useSongsStore();
const galaxyStore = useGalaxyStore();
const playerStore = usePlayerStore();

const isExpanded = ref(false);
const query = ref('');
const listResult = ref<ISong[]>([]);
const inputRef = ref<HTMLInputElement | null>(null);
const activeIndex = ref(-1);

const MAX_SONG = 8;
const MAX_ARTIST = 4;
const MAX_ANIME = 4;

// ── Reactive search ──
watch(query, (q) => {
  const trimmed = q.trim();
  if (trimmed.length < 2) {
    listResult.value = [];
    return;
  }
  listResult.value = songsStore.searchSongs(trimmed);
  activeIndex.value = -1;
});

watch(isExpanded, (val) => {
  if (val) {
    nextTick(() => inputRef.value?.focus());
  }
});

// ── Computed grouped results (cached, not re-scanned per render) ──
const listSongResult = computed(() => listResult.value.slice(0, MAX_SONG));

const listUniqueArtist = computed(() => {
  const seen = new Set<string>();
  const list: string[] = [];
  for (let i = 0; i < listResult.value.length; i += 1) {
    const name = listResult.value[i].artist?.name;
    if (name && !seen.has(name)) {
      seen.add(name);
      list.push(name);
      if (list.length >= MAX_ARTIST) { break; }
    }
  }
  return list;
});

const listUniqueAnime = computed(() => {
  const seen = new Set<string>();
  const list: string[] = [];
  for (let i = 0; i < listResult.value.length; i += 1) {
    const title = listResult.value[i].anime?.title;
    if (title && !seen.has(title)) {
      seen.add(title);
      list.push(title);
      if (list.length >= MAX_ANIME) { break; }
    }
  }
  return list;
});

// ── Flat item list for keyboard nav ──
const totalItem = computed(() =>
  listSongResult.value.length + listUniqueArtist.value.length + listUniqueAnime.value.length
);

// ── Actions ──
const onSelectSong = (song: ISong) => {
  playerStore.play(song, true);
  galaxyStore.selectedSongId = song.id;
  galaxyStore.flyToStar(song.id);
  close();
};

const onSelectArtist = (artistName: string) => {
  const song = listResult.value.find((s) => s.artist?.name === artistName);
  if (song) { onSelectSong(song); }
};

const onSelectAnime = (animeTitle: string) => {
  const song = listResult.value.find((s) => s.anime?.title === animeTitle);
  if (song) { onSelectSong(song); }
};

const selectByIndex = (index: number) => {
  const songCount = listSongResult.value.length;
  const artistCount = listUniqueArtist.value.length;

  if (index < songCount) {
    onSelectSong(listSongResult.value[index]);
  } else if (index < songCount + artistCount) {
    onSelectArtist(listUniqueArtist.value[index - songCount]);
  } else {
    onSelectAnime(listUniqueAnime.value[index - songCount - artistCount]);
  }
};

const close = () => {
  isExpanded.value = false;
  query.value = '';
  listResult.value = [];
  activeIndex.value = -1;
};

// ── Keyboard handling ──
const isInsideEditable = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) { return false; }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
};

const onPanelKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (totalItem.value > 0) {
      activeIndex.value = (activeIndex.value + 1) % totalItem.value;
      scrollActiveIntoView();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (totalItem.value > 0) {
      activeIndex.value = activeIndex.value <= 0
        ? totalItem.value - 1
        : activeIndex.value - 1;
      scrollActiveIntoView();
    }
  } else if (e.key === 'Enter' && activeIndex.value >= 0) {
    e.preventDefault();
    selectByIndex(activeIndex.value);
  }
};

const scrollActiveIntoView = () => {
  nextTick(() => {
    const el = document.querySelector('.search-result-item--active');
    if (el) { el.scrollIntoView({ block: 'nearest' }); }
  });
};

const onGlobalKeyDown = (e: KeyboardEvent) => {
  if (e.key === '/' && !isExpanded.value && !isInsideEditable(e.target)) {
    e.preventDefault();
    isExpanded.value = true;
  }
  if (e.key === 'Escape' && isExpanded.value) {
    close();
  }
};

useEventListener(window, 'keydown', onGlobalKeyDown);

// ── Highlight matching text ──
const highlightMatch = (text: string, q: string): string => {
  if (!q || q.length < 2) { return escapeHtml(text); }
  const escaped = escapeRegex(q);
  const regex = new RegExp(`(${escaped})`, 'gi');
  return escapeHtml(text).replace(
    regex,
    '<mark class="search-highlight">$1</mark>',
  );
};

const escapeHtml = (str: string): string => {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// ── Index helpers for active class ──
const songIndex = (i: number) => i;
const artistIndex = (i: number) => listSongResult.value.length + i;
const animeIndex = (i: number) => listSongResult.value.length + listUniqueArtist.value.length + i;

// ── Song type badge label ──
const songBadge = (song: ISong): string => {
  const seq = song.sequence ? song.sequence : '';
  return `${song.type}${seq}`;
};
</script>

<template>
  <div class="search-bar-root">
    <!-- Collapsed: compact pill button -->
    <Transition name="search-toggle">
      <button
        v-if="!isExpanded"
        class="search-trigger"
        :class="{ 'search-trigger--hidden': !props.isVisible }"
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
        <div class="search-backdrop" @click="close" />

        <div
          class="search-panel"
          @keydown="onPanelKeyDown"
        >
          <div class="search-input-row">
            <Search :size="18" class="search-icon" />
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

          <!-- Results -->
          <div
            v-if="listResult.length > 0"
            class="search-results"
          >
            <!-- Songs -->
            <div v-if="listSongResult.length > 0">
              <div class="search-group-header">
                <Music :size="12" />
                <span>Songs</span>
              </div>
              <div
                v-for="(song, i) in listSongResult"
                :key="song.id"
                class="search-result-item"
                :class="{ 'search-result-item--active': activeIndex === songIndex(i) }"
                tabindex="0"
                role="button"
                @click="onSelectSong(song)"
                @keydown.enter="onSelectSong(song)"
                @mouseenter="activeIndex = songIndex(i)"
              >
                <p class="search-result-title">
                  <span class="search-badge" :class="song.type === 'OP' ? 'search-badge--op' : 'search-badge--ed'">{{ songBadge(song) }}</span>
                  <span v-html="highlightMatch(song.title, query.trim())" />
                </p>
                <p class="search-result-meta">
                  <span v-html="highlightMatch(song.artist?.name || '', query.trim())" />
                  <span v-if="song.anime?.title"> · <span v-html="highlightMatch(song.anime.title, query.trim())" /></span>
                </p>
              </div>
            </div>

            <!-- Artists -->
            <div v-if="listUniqueArtist.length > 0">
              <div class="search-group-header">
                <User :size="12" />
                <span>Artists</span>
              </div>
              <div
                v-for="(artistName, i) in listUniqueArtist"
                :key="artistName"
                class="search-result-item"
                :class="{ 'search-result-item--active': activeIndex === artistIndex(i) }"
                tabindex="0"
                role="button"
                @click="onSelectArtist(artistName)"
                @keydown.enter="onSelectArtist(artistName)"
                @mouseenter="activeIndex = artistIndex(i)"
              >
                <p class="search-result-title" v-html="highlightMatch(artistName, query.trim())" />
              </div>
            </div>

            <!-- Anime -->
            <div v-if="listUniqueAnime.length > 0">
              <div class="search-group-header">
                <Tv :size="12" />
                <span>Anime</span>
              </div>
              <div
                v-for="(animeTitle, i) in listUniqueAnime"
                :key="animeTitle"
                class="search-result-item"
                :class="{ 'search-result-item--active': activeIndex === animeIndex(i) }"
                tabindex="0"
                role="button"
                @click="onSelectAnime(animeTitle)"
                @keydown.enter="onSelectAnime(animeTitle)"
                @mouseenter="activeIndex = animeIndex(i)"
              >
                <p class="search-result-title" v-html="highlightMatch(animeTitle, query.trim())" />
              </div>
            </div>

            <!-- Result count -->
            <div class="search-footer">
              Showing {{ totalItem }} of {{ listResult.length.toLocaleString() }} results
            </div>
          </div>

          <!-- No results -->
          <div
            v-else-if="query.trim().length >= 2"
            class="search-empty"
          >
            No results for "{{ query }}"
          </div>

          <!-- Hint (only when empty query) -->
          <div
            v-else-if="query.length === 0"
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
  position: absolute;
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

/* --- Collapsed trigger --- */
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
  transition: all 0.3s ease;
  white-space: nowrap;
}

.search-trigger--hidden {
  opacity: 0;
  pointer-events: none;
}

.search-trigger:hover {
  border-color: rgba(79, 70, 229, 0.5);
  color: #e8e8f0;
  background: rgba(20, 21, 41, 0.9);
}

.search-trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
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
  position: absolute;
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
  max-height: calc(100vh - 8rem);
  align-self: flex-start;
}

.search-input-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.search-icon {
  color: #9b9bb4;
  flex-shrink: 0;
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

.search-close-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.8);
}

/* --- Results --- */
.search-results {
  overflow-y: auto;
  max-height: 24rem;
  padding-bottom: 0;
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
  transition: background 0.1s ease;
}

.search-result-item:hover,
.search-result-item--active {
  background: rgba(79, 70, 229, 0.12);
}

.search-result-item:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px rgba(79, 70, 229, 0.8);
  background: rgba(79, 70, 229, 0.12);
}

.search-result-title {
  font-size: 0.875rem;
  color: #e8e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.search-result-meta {
  font-size: 0.75rem;
  color: #9b9bb4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 0.125rem;
}

/* --- Badge --- */
.search-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.0625rem 0.3125rem;
  border-radius: 0.25rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.search-badge--op {
  background: rgba(79, 70, 229, 0.2);
  color: #a5b4fc;
}

.search-badge--ed {
  background: rgba(236, 72, 153, 0.2);
  color: #f9a8d4;
}

/* --- Highlight --- */
.search-result-item :deep(.search-highlight) {
  background: rgba(79, 70, 229, 0.3);
  color: #e8e8f0;
  border-radius: 2px;
  padding: 0 1px;
}

/* --- Footer --- */
.search-footer {
  padding: 0.5rem 1rem;
  font-size: 0.6875rem;
  color: rgba(155, 155, 180, 0.5);
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

/* --- Empty / hint states --- */
.search-empty {
  padding: 1.25rem 1rem;
  font-size: 0.8125rem;
  color: #9b9bb4;
  text-align: center;
}

.search-hint {
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  color: rgba(155, 155, 180, 0.5);
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
