import * as THREE from "three";
import type { TGenre } from "@/types";
import { GENRE_COLOR_MAP } from "@/types";

/** Minimal star data needed for layout computation */
export interface IStarLayoutData {
  id: number;
  year?: number;
  genre?: string;
  vote_count?: number;
  voteCount?: number; // galaxy-data.ts uses camelCase
}

// ─── Galaxy parameters ───────────────────────────────────────────────
const R_MAX = 500;
const TOTAL_SPAN_YEARS = 46;
const NUM_ARMS = 4; // spiral arms
const ARM_SEPARATION = (Math.PI * 2) / NUM_ARMS; // 90° between arms
// Logarithmic spiral pitch — smaller = more tightly wound
const SPIRAL_B = 0.22;

// Maps genre to spiral arm index (0–3)
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

// Logarithmic size mapping: vote_count → [0.8, 2.5]
const computeStarSize = (voteCount: number): number => {
  const MIN_SIZE = 0.8;
  const MAX_SIZE = 2.5;
  const clamped = Math.max(1, voteCount);
  const logVal = Math.log2(clamped);
  const logMax = Math.log2(10000);
  const normalised = Math.min(logVal / logMax, 1);
  return MIN_SIZE + normalised * (MAX_SIZE - MIN_SIZE);
};

// Box-Muller transform: 2 uniform randoms → 1 Gaussian random (mean=0, sd=1)
const gaussianRandom = (u1: number, u2: number): number => {
  // Clamp to avoid log(0)
  const safe = Math.max(u1, 0.0001);
  return Math.sqrt(-2 * Math.log(safe)) * Math.cos(Math.PI * 2 * u2);
};

// ─── Core position function (shared by computeBuffers & computeSinglePosition) ──
const computeStarPosition = (
  songId: number,
  year: number,
  genre: string | undefined,
): { x: number; y: number } => {
  const clampedYear = Math.max(1980, Math.min(year, 1980 + TOTAL_SPAN_YEARS));
  // Sub-year variation so songs of the same year spread within ±0.5 year
  const subYear = ((songId * 2654435761) >>> 0) / 4294967296 - 0.5;
  // normalised: 0 = oldest (1980), 1 = newest (2026)
  const normalised = (clampedYear - 1980 + subYear) / TOTAL_SPAN_YEARS;

  const armIndex = GENRE_ARM_MAP[genre ?? "other"] ?? 2;
  const rng = seededRandom(songId);
  const r1 = rng();
  const r2 = rng();
  const r3 = rng();
  const r4 = rng();
  const r5 = rng();

  // distFrac: 0 = center (newest), 1 = outer rim (oldest)
  const distFrac = 1 - normalised;

  // ── Central bulge ──
  // Stars very near center scatter into a Gaussian bulge
  const BULGE_CUTOFF = 0.1;
  if (distFrac < BULGE_CUTOFF) {
    const bulgeProb = (1 - distFrac / BULGE_CUTOFF) * 0.8;
    if (r5 < bulgeProb) {
      // 2D Gaussian scatter for natural round bulge
      const gx = gaussianRandom(r1, r2) * 0.45;
      const gy = gaussianRandom(r3, r4) * 0.45;
      const bulgeScale = R_MAX * 0.08;
      return { x: gx * bulgeScale, y: gy * bulgeScale };
    }
  }

  // ── Inter-arm disk population (~6%) ──
  // Sparse scatter between arms for realistic thin disk
  if (r5 > 0.94 && distFrac >= BULGE_CUTOFF) {
    const randAngle = r1 * Math.PI * 2;
    const radialNoise = gaussianRandom(r3, r4) * 0.05;
    const r = Math.max(R_MAX * distFrac * (1 + radialNoise), 2);
    return { x: r * Math.cos(randAngle), y: r * Math.sin(randAngle) };
  }

  // ── Logarithmic spiral arm placement ──
  // theta = (1/b) * ln(distFrac + epsilon)
  // Tighter b value → more winding, sharper spiral arms
  const epsilon = 0.008;
  const spiralAngle = (1 / SPIRAL_B) * Math.log(distFrac + epsilon) + 16;
  const radius = R_MAX * distFrac;

  // Arm base offset (genre determines which arm)
  const armAngle = armIndex * ARM_SEPARATION;

  // Angular jitter: tight near center for sharp arms, wider at rim
  const armSigma = 0.06 + distFrac * 0.16;
  const angleJitter = gaussianRandom(r1, r2) * armSigma;

  // Radial jitter: proportional to radius for consistent arm look
  const radialJitter = gaussianRandom(r3, r4) * 0.07;

  const finalAngle = spiralAngle + armAngle + angleJitter;
  const finalRadius = Math.max(radius * (1 + radialJitter), 2);

  return {
    x: finalRadius * Math.cos(finalAngle),
    y: finalRadius * Math.sin(finalAngle),
  };
};

export const useGalaxyLayout = () => {
  const computeBuffers = (
    listSong: IStarLayoutData[],
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
      const pos = computeStarPosition(song.id, song.year ?? 1980, song.genre);
      const size = computeStarSize(song.vote_count ?? song.voteCount ?? 0);

      // Random Z-rotation per star so quads don't align
      const rng = seededRandom(song.id);
      // Skip the 5 random values used by computeStarPosition
      rng();
      rng();
      rng();
      rng();
      rng();
      const zRotation = rng() * Math.PI * 2;

      dummy.position.set(pos.x, pos.y, 0);
      dummy.rotation.set(0, 0, zRotation);
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

  const computeSinglePosition = (
    songId: number,
    year: number,
    genre: TGenre | undefined,
  ): THREE.Vector3 => {
    const pos = computeStarPosition(songId, year, genre);
    return new THREE.Vector3(pos.x, pos.y, 0);
  };

  return { computeBuffers, computeSinglePosition };
};
