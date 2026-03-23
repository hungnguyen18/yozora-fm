<script setup lang="ts">
import { shallowRef, watch, onMounted, markRaw } from 'vue';
import * as THREE from 'three';
import { useGalaxyStore } from '@/stores/galaxy';
import { useSongsStore } from '@/stores/songs';
import { useLOD } from '@/composables/useLOD';
import { useGalaxyLayout } from '@/composables/useGalaxyLayout';
import { GENRE_COLOR_MAP } from '@/types';
import type { ISong, TGenre } from '@/types';

const galaxyStore = useGalaxyStore();
const songsStore = useSongsStore();
const { showConstellations } = useLOD();
const { computeSinglePosition } = useGalaxyLayout();

const lineGroup = shallowRef<THREE.Group>(markRaw(new THREE.Group()));

// Cache of line objects keyed by artist_id so we can show/hide individually
const artistLineMap = new Map<number, THREE.LineSegments>();

// Build line segments for each artist with 2+ songs and add them to lineGroup
const buildConstellationLines = (): void => {
  const listSong = songsStore.listSong;
  if (listSong.length === 0) { return; }

  // Remove previous objects from group
  for (const lines of artistLineMap.values()) {
    lineGroup.value.remove(lines);
    lines.geometry.dispose();
    (lines.material as THREE.Material).dispose();
  }
  artistLineMap.clear();

  // Build a Map<songId, ISong> for O(1) lookups instead of listSong.find()
  const songById = new Map<number, ISong>();
  for (let i = 0; i < listSong.length; i += 1) {
    songById.set(listSong[i].id, listSong[i]);
  }

  // Ensure constellationData is populated
  galaxyStore.computeConstellations(listSong);

  for (const [artistId, listSongId] of galaxyStore.constellationData.entries()) {
    if (listSongId.length < 2) { continue; }

    // Collect positions for all songs of this artist
    const listPosition: THREE.Vector3[] = [];

    for (let i = 0; i < listSongId.length; i += 1) {
      const songId = listSongId[i];
      const song = songById.get(songId);
      if (!song) { continue; }

      const pos = computeSinglePosition(song.id, song.year ?? 1980, song.genre);
      listPosition.push(pos);
    }

    if (listPosition.length < 2) { continue; }

    // Determine genre colour from first song of this artist
    const firstSong = songById.get(listSongId[0]);
    const genreKey: TGenre = (firstSong?.genre ?? 'other') as TGenre;
    const hexColor = GENRE_COLOR_MAP[genreKey] ?? GENRE_COLOR_MAP.other;
    const color = new THREE.Color(hexColor);

    // Build line segment pairs: connect each consecutive pair of positions
    // (sequential connection rather than full mesh; keeps lines readable)
    const listVertex: number[] = [];
    for (let i = 0; i < listPosition.length - 1; i += 1) {
      const a = listPosition[i];
      const b = listPosition[i + 1];
      listVertex.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(listVertex, 3));

    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.0, // hidden by default; revealed on hover
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const lineSegments = new THREE.LineSegments(geometry, material);
    lineGroup.value.add(lineSegments);
    artistLineMap.set(artistId, lineSegments);
  }
};

// Show constellation for the artist of the hovered star, hide all others
const updateVisibility = (hoveredStarId: number | null): void => {
  if (!showConstellations.value) {
    // All hidden when LOD says so
    for (const lines of artistLineMap.values()) {
      (lines.material as THREE.LineBasicMaterial).opacity = 0.0;
    }
    return;
  }

  const focusedId = galaxyStore.focusedArtistId;

  if (hoveredStarId === null && focusedId === null) {
    // No hover and no focus — hide all constellations
    for (const lines of artistLineMap.values()) {
      (lines.material as THREE.LineBasicMaterial).opacity = 0.0;
    }
    return;
  }

  // hoveredStarId is song.id — find the matching song by id
  let hoveredArtistId: number | null = null;
  if (hoveredStarId !== null) {
    const listSong = songsStore.listSong;
    const hoveredSong = listSong.find((s) => s.id === hoveredStarId) ?? null;
    if (hoveredSong) {
      hoveredArtistId = hoveredSong.artist_id;
    }
  }

  for (const [artistId, lines] of artistLineMap.entries()) {
    const mat = lines.material as THREE.LineBasicMaterial;
    if (artistId === hoveredArtistId) {
      mat.opacity = 0.35;
    } else if (artistId === focusedId) {
      mat.opacity = 0.5;
    } else {
      mat.opacity = 0.0;
    }
  }
};

onMounted(async () => {
  if (songsStore.listSong.length === 0) {
    await songsStore.fetchSongs();
  }
  buildConstellationLines();
});

// Rebuild if songs are loaded after mount
watch(
  () => songsStore.listSong.length,
  (newLen, oldLen) => {
    if (newLen > 0 && oldLen === 0) {
      buildConstellationLines();
    }
  },
);

// React to hover changes
watch(
  () => galaxyStore.hoveredStarId,
  (nextId) => {
    updateVisibility(nextId);
  },
);

// React to focused artist changes (constellation focus mode)
watch(
  () => galaxyStore.focusedArtistId,
  () => {
    updateVisibility(galaxyStore.hoveredStarId);
  },
);

// React to LOD changes
watch(showConstellations, () => {
  updateVisibility(galaxyStore.hoveredStarId);
});
</script>

<template>
  <primitive :object="lineGroup" />
</template>
