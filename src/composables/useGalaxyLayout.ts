import * as THREE from "three";
import type { ISong, TGenre } from "@/types";
import { GENRE_COLOR_MAP } from "@/types";

const R_MAX = 500;
const TOTAL_SPAN_YEARS = 46;
const MAX_ANGLE_DEG = 1620;

// Maps genre to spiral arm index (0-3); 4 arms separated by 90° each
const GENRE_ARM_MAP: Record<string, number> = {
  rock: 0,
  electronic: 1,
  pop: 2,
  ballad: 3,
  orchestral: 0,
  other: 2,
};

// Mulberry32 seeded PRNG for reproducible per-song jitter
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

// Parse a CSS hex colour string (#RRGGBB) into Three.js Color
const hexToColor = (hex: string): THREE.Color => {
  return new THREE.Color(hex);
};

// Logarithmic size mapping: vote_count → [1.0, 4.0]
const computeStarSize = (voteCount: number): number => {
  const MIN_SIZE = 4.0;
  const MAX_SIZE = 15.0;
  // log2(1) = 0, treat vote_count of 0 as 1 to avoid log(0)
  const clamped = Math.max(1, voteCount);
  // Scale: log2 range from 0 to ~10 maps nicely to [1, 4]
  const logVal = Math.log2(clamped);
  const logMax = Math.log2(10000); // assumed max reasonable vote count
  const normalised = Math.min(logVal / logMax, 1);
  return MIN_SIZE + normalised * (MAX_SIZE - MIN_SIZE);
};

export const useGalaxyLayout = () => {
  const computeBuffers = (
    listSong: ISong[],
  ): {
    matrices: Float32Array;
    colors: Float32Array;
    sizes: Float32Array;
    count: number;
  } => {
    const count = listSong.length;
    const matrices = new Float32Array(count * 16);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      const song = listSong[i];
      const year = song.year ?? 1980;
      const clampedYear = Math.max(
        1980,
        Math.min(year, 1980 + TOTAL_SPAN_YEARS),
      );
      const normalised = (clampedYear - 1980) / TOTAL_SPAN_YEARS;

      const baseAngleDeg = normalised * MAX_ANGLE_DEG;
      const baseRadius = R_MAX * (1 - normalised);

      const armIndex = GENRE_ARM_MAP[song.genre ?? "other"] ?? 2;
      const armOffsetDeg = armIndex * 90;

      const rng = seededRandom(song.id);
      const angleJitterDeg = (rng() * 2 - 1) * 5;
      const radiusJitterPct = (rng() * 2 - 1) * 0.02;

      const angleDeg = baseAngleDeg + armOffsetDeg + angleJitterDeg;
      const angleRad = (angleDeg * Math.PI) / 180;
      const radius = baseRadius * (1 + radiusJitterPct);

      const x = radius * Math.cos(angleRad);
      const y = radius * Math.sin(angleRad);
      const size = computeStarSize(song.vote_count);

      dummy.position.set(x, y, 0);
      dummy.scale.set(size, size, 1);
      dummy.updateMatrix();
      dummy.matrix.toArray(matrices, i * 16);

      const genreKey = (song.genre ?? "other") as TGenre;
      const hexColor = GENRE_COLOR_MAP[genreKey] ?? GENRE_COLOR_MAP.other;
      color.copy(hexToColor(hexColor));
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = size;
    }

    return { matrices, colors, sizes, count };
  };

  return { computeBuffers };
};
