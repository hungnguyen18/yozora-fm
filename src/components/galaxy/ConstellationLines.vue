<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import * as THREE from 'three';
import { useGalaxyStore } from '@/stores/galaxy';
import { useSongsStore } from '@/stores/songs';
import { useLOD } from '@/composables/useLOD';
import { GENRE_COLOR_MAP } from '@/types';
import type { TGenre } from '@/types';

const galaxyStore = useGalaxyStore();
const songsStore = useSongsStore();
const { showConstellations } = useLOD();

const lineGroup = ref<THREE.Group>(new THREE.Group());

// Cache of line objects keyed by artist_id so we can show/hide individually
const artistLineMap = new Map<number, THREE.LineSegments>();

// Re-use the same position computation as useGalaxyLayout to get star world positions
const R_MAX = 500;
const TOTAL_SPAN_YEARS = 46;
const MAX_ANGLE_DEG = 1620;

const GENRE_ARM_MAP: Record<string, number> = {
  rock: 0,
  electronic: 1,
  pop: 2,
  ballad: 3,
  orchestral: 0,
  other: 2,
};

const seededRandom = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const computeSongPosition = (songId: number, year: number, genre: TGenre | undefined): THREE.Vector3 => {
  const clampedYear = Math.max(1980, Math.min(year, 1980 + TOTAL_SPAN_YEARS));
  const normalised = (clampedYear - 1980) / TOTAL_SPAN_YEARS;

  const baseAngleDeg = normalised * MAX_ANGLE_DEG;
  const baseRadius = R_MAX * (1 - normalised);

  const armIndex = GENRE_ARM_MAP[genre ?? 'other'] ?? 2;
  const armOffsetDeg = armIndex * 90;

  const rng = seededRandom(songId);
  const angleJitterDeg = (rng() * 2 - 1) * 5;
  const radiusJitterPct = (rng() * 2 - 1) * 0.02;

  const angleDeg = baseAngleDeg + armOffsetDeg + angleJitterDeg;
  const angleRad = (angleDeg * Math.PI) / 180;
  const radius = baseRadius * (1 + radiusJitterPct);

  return new THREE.Vector3(radius * Math.cos(angleRad), radius * Math.sin(angleRad), 0);
};

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

  // Ensure constellationData is populated
  galaxyStore.computeConstellations(listSong);

  for (const [artistId, listSongId] of galaxyStore.constellationData.entries()) {
    if (listSongId.length < 2) { continue; }

    // Collect positions for all songs of this artist
    const listPosition: THREE.Vector3[] = [];

    for (let i = 0; i < listSongId.length; i += 1) {
      const songId = listSongId[i];
      const song = listSong.find((s) => s.id === songId);
      if (!song) { continue; }

      const pos = computeSongPosition(song.id, song.year ?? 1980, song.genre);
      listPosition.push(pos);
    }

    if (listPosition.length < 2) { continue; }

    // Determine genre colour from first song of this artist
    const firstSong = listSong.find((s) => s.artist_id === artistId);
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

  if (hoveredStarId === null) {
    // No hover — hide all constellations
    for (const lines of artistLineMap.values()) {
      (lines.material as THREE.LineBasicMaterial).opacity = 0.0;
    }
    return;
  }

  // hoveredStarId is song.id — find the matching song by id
  const listSong = songsStore.listSong;
  const hoveredSong = listSong.find((s) => s.id === hoveredStarId) ?? null;
  if (!hoveredSong) { return; }

  const hoveredArtistId = hoveredSong.artist_id;

  for (const [artistId, lines] of artistLineMap.entries()) {
    const mat = lines.material as THREE.LineBasicMaterial;
    mat.opacity = artistId === hoveredArtistId ? 0.35 : 0.0;
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

// React to LOD changes
watch(showConstellations, () => {
  updateVisibility(galaxyStore.hoveredStarId);
});
</script>

<template>
  <primitive :object="lineGroup" />
</template>
