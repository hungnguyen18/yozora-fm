<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { Search, X } from 'lucide-vue-next';
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
const isSearching = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

// Debounced search (300ms)
const doSearch = useDebounceFn(async () => {
  if (query.value.trim().length < 2) {
    listResult.value = [];
    return;
  }
  isSearching.value = true;
  listResult.value = await songsStore.searchSongs(query.value);
  isSearching.value = false;
}, 300);

watch(query, () => doSearch());

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

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === '/' && !isExpanded.value) {
    e.preventDefault();
    isExpanded.value = true;
  }
  if (e.key === 'Escape') {
    close();
  }
};

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div class="fixed top-4 left-4 z-20">
    <!-- Collapsed: icon button -->
    <button
      v-if="!isExpanded"
      class="flex items-center justify-center w-10 h-10 rounded-full bg-midnight border border-primary/30 text-soft-white hover:border-primary transition-colors cursor-pointer"
      aria-label="Open search"
      @click="isExpanded = true"
    >
      <Search :size="20" />
    </button>

    <!-- Expanded: input + results -->
    <div v-else class="flex flex-col w-80">
      <div class="flex items-center gap-2 bg-midnight border border-primary/30 focus-within:border-primary rounded-lg px-3 py-2 transition-colors">
        <Search :size="16" class="text-muted-lavender shrink-0" />
        <input
          ref="inputRef"
          v-model="query"
          type="text"
          class="flex-1 bg-transparent text-soft-white text-sm placeholder:text-muted-lavender outline-none"
          placeholder="Search songs, artists, anime..."
          @keydown.escape="close"
        />
        <button
          class="text-muted-lavender hover:text-soft-white transition-colors cursor-pointer"
          aria-label="Close search"
          @click="close"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Results dropdown -->
      <div
        v-if="isSearching || listResult.length > 0"
        class="mt-1 bg-midnight border border-white/10 rounded-lg shadow-xl max-h-80 overflow-y-auto"
      >
        <!-- Loading state -->
        <div v-if="isSearching" class="px-4 py-3 text-sm text-muted-lavender">
          Searching...
        </div>

        <template v-else>
          <!-- Songs group -->
          <div v-if="listResult.length > 0">
            <div class="px-4 pt-3 pb-1 text-xs text-muted-lavender uppercase tracking-wider">
              Songs
            </div>
            <div
              v-for="song in listResult"
              :key="song.id"
              class="px-4 py-2 cursor-pointer hover:bg-primary/10 transition-colors"
              @click="onSelectSong(song)"
            >
              <p class="text-sm text-soft-white truncate">{{ song.title }}</p>
              <p class="text-xs text-muted-lavender truncate">
                {{ song.artist?.name }}
                <span v-if="song.anime?.title"> · {{ song.anime.title }}</span>
              </p>
            </div>
          </div>

          <!-- Artists group -->
          <div v-if="uniqueArtists().length > 0">
            <div class="px-4 pt-3 pb-1 text-xs text-muted-lavender uppercase tracking-wider">
              Artists
            </div>
            <div
              v-for="artistName in uniqueArtists()"
              :key="artistName"
              class="px-4 py-2 cursor-pointer hover:bg-primary/10 transition-colors"
              @click="onSelectSong(listResult.find((s) => s.artist?.name === artistName)!)"
            >
              <p class="text-sm text-soft-white truncate">{{ artistName }}</p>
            </div>
          </div>

          <!-- Anime group -->
          <div v-if="uniqueAnime().length > 0">
            <div class="px-4 pt-3 pb-1 text-xs text-muted-lavender uppercase tracking-wider">
              Anime
            </div>
            <div
              v-for="animeTitle in uniqueAnime()"
              :key="animeTitle"
              class="px-4 py-2 cursor-pointer hover:bg-primary/10 transition-colors"
              @click="onSelectSong(listResult.find((s) => s.anime?.title === animeTitle)!)"
            >
              <p class="text-sm text-soft-white truncate">{{ animeTitle }}</p>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
