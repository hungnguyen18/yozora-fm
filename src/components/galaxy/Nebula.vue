<script setup lang="ts">
// Nebula — atmospheric background planes with radial gradient textures.
// Renders behind the star field to add depth and colour to the galaxy.
// Now with slow breathing animation and richer cloud variety.

import { shallowRef, onMounted, onBeforeUnmount, markRaw } from 'vue';
import { useLoop } from '@tresjs/core';
import * as THREE from 'three';

// Paint a radial gradient onto a square canvas with soft circular falloff.
// Pixels outside the inscribed circle are fully transparent — no rectangle edges.
const createNebulaTexture = (
  color1: string,
  color2: string,
  size = 512,
  noiseIntensity = 0,
): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Draw radial gradient that fades to transparent by 70% radius
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(0.25, color2 + '60');
  gradient.addColorStop(0.5, color2 + '20');
  gradient.addColorStop(0.7, color2 + '08');
  gradient.addColorStop(1, color2 + '00');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Mask: zero out alpha for pixels outside the inscribed circle
  const imageData = ctx.getImageData(0, 0, size, size);
  const pixels = imageData.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - half;
      const dy = y - half;
      const dist = Math.sqrt(dx * dx + dy * dy) / half;
      const idx = (y * size + x) * 4;

      if (dist > 1) {
        // Outside circle — fully transparent
        pixels[idx + 3] = 0;
      } else if (dist > 0.7) {
        // Feather edge — extra smooth falloff
        const fade = 1 - (dist - 0.7) / 0.3;
        pixels[idx + 3] = Math.round(pixels[idx + 3] * fade * fade);
      }

      // Add subtle noise for organic feel
      if (noiseIntensity > 0 && pixels[idx + 3] > 0) {
        const noise = (Math.random() - 0.5) * noiseIntensity;
        pixels[idx] = Math.max(0, Math.min(255, pixels[idx] + noise));
        pixels[idx + 1] = Math.max(0, Math.min(255, pixels[idx + 1] + noise));
        pixels[idx + 2] = Math.max(0, Math.min(255, pixels[idx + 2] + noise));
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  return new THREE.CanvasTexture(canvas);
};

// Elongated wispy texture — elliptical falloff, no rectangle edges.
const createWispTexture = (color: string, size = 512): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;

  // Radial gradient on square canvas
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, color + '28');
  gradient.addColorStop(0.3, color + '15');
  gradient.addColorStop(0.6, color + '06');
  gradient.addColorStop(1, color + '00');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Elliptical mask: stretch X wider than Y for wispy shape
  const imageData = ctx.getImageData(0, 0, size, size);
  const pixels = imageData.data;
  const aspectX = 1.0; // full width
  const aspectY = 2.5; // compressed height — creates horizontal wisp
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - half) / half * aspectX;
      const dy = (y - half) / half * aspectY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;

      if (dist > 1) {
        pixels[idx + 3] = 0;
      } else if (dist > 0.6) {
        const fade = 1 - (dist - 0.6) / 0.4;
        pixels[idx + 3] = Math.round(pixels[idx + 3] * fade * fade);
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  return new THREE.CanvasTexture(canvas);
};

type TNebulaConfig = {
  color1: string;
  color2: string;
  z: number;
  scale: number;
  scaleY?: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
  rotationZ: number;
  breathSpeed: number;   // oscillation speed (0 = static)
  breathRange: number;   // opacity oscillation range
  isWisp?: boolean;
};

const listNebulaConfig: TNebulaConfig[] = [
  // Core glow — bright indigo heart of the galaxy
  { color1: '#4F46E5', color2: '#4F46E5', z: -50,  scale: 900, opacity: 0.22, offsetX: 0,    offsetY: 0,    rotationZ: 0,    breathSpeed: 0.15, breathRange: 0.05 },
  // Inner purple haze — warm glow around center
  { color1: '#7C3AED', color2: '#7C3AED', z: -55,  scale: 500, opacity: 0.18, offsetX: 20,   offsetY: -20,  rotationZ: 0.2,  breathSpeed: 0.12, breathRange: 0.04 },
  // Purple cloud — drifts off-center
  { color1: '#7C3AED', color2: '#7C3AED', z: -80,  scale: 700, opacity: 0.12, offsetX: 100,  offsetY: -50,  rotationZ: 0.3,  breathSpeed: 0.10, breathRange: 0.04 },
  // Hot pink accent — vivid pop of color
  { color1: '#EC4899', color2: '#EC4899', z: -95,  scale: 450, opacity: 0.08, offsetX: -60,  offsetY: 80,   rotationZ: -0.3, breathSpeed: 0.22, breathRange: 0.03 },
  // Warm accent — rose tint
  { color1: '#F97066', color2: '#F97066', z: -100, scale: 550, opacity: 0.07, offsetX: -80,  offsetY: 100,  rotationZ: -0.2, breathSpeed: 0.20, breathRange: 0.03 },
  // Cyan/teal accent — vivid color variety
  { color1: '#06B6D4', color2: '#06B6D4', z: -90,  scale: 600, opacity: 0.09, offsetX: -140, offsetY: -80,  rotationZ: 0.5,  breathSpeed: 0.14, breathRange: 0.03 },
  // Emerald accent — green tint for arm diversity
  { color1: '#10B981', color2: '#10B981', z: -105, scale: 400, opacity: 0.05, offsetX: 160,  offsetY: -100, rotationZ: 0.7,  breathSpeed: 0.16, breathRange: 0.02 },
  // Amber warm glow — outer rim
  { color1: '#F59E0B', color2: '#F59E0B', z: -110, scale: 500, opacity: 0.06, offsetX: 150,  offsetY: 120,  rotationZ: -0.4, breathSpeed: 0.18, breathRange: 0.02 },
  // Spiral arm wisps (elliptical shape baked into texture)
  { color1: '#818CF8', color2: '#818CF8', z: -60,  scale: 800, opacity: 0.08, offsetX: 60,   offsetY: 30,   rotationZ: 0.6,  breathSpeed: 0.08, breathRange: 0.03, isWisp: true },
  { color1: '#A78BFA', color2: '#A78BFA', z: -70,  scale: 750, opacity: 0.07, offsetX: -40,  offsetY: -60,  rotationZ: -0.8, breathSpeed: 0.09, breathRange: 0.02, isWisp: true },
  { color1: '#C084FC', color2: '#C084FC', z: -65,  scale: 600, opacity: 0.06, offsetX: -100, offsetY: 50,   rotationZ: 1.2,  breathSpeed: 0.11, breathRange: 0.025, isWisp: true },
];

const nebulaGroup = shallowRef<THREE.Group>(markRaw(new THREE.Group()));
const listMesh = shallowRef<THREE.Mesh[]>([]);
const listTexture: THREE.CanvasTexture[] = [];
const listMaterial: THREE.MeshBasicMaterial[] = [];
const listConfig: TNebulaConfig[] = [];

// Gentle rotation — full revolution in ~12 minutes (0.0087 rad/s ≈ 0.5°/s)
const GALAXY_ROTATION_SPEED = 0.0087;

onMounted(() => {
  const meshes: THREE.Mesh[] = [];

  for (let i = 0; i < listNebulaConfig.length; i += 1) {
    const config = listNebulaConfig[i];
    const texture = config.isWisp
      ? createWispTexture(config.color1)
      : createNebulaTexture(config.color1, config.color2, 512, 15);
    listTexture.push(texture);

    // CircleGeometry eliminates rectangular edges entirely
    const geometry = new THREE.CircleGeometry(0.5, 64);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: config.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    listMaterial.push(material);
    listConfig.push(config);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(config.offsetX, config.offsetY, config.z);
    mesh.rotation.z = config.rotationZ;
    mesh.scale.set(config.scale, config.scaleY ?? config.scale, 1);

    nebulaGroup.value.add(mesh);
    meshes.push(mesh);
  }

  listMesh.value = meshes;
});

onBeforeUnmount(() => {
  for (let i = 0; i < listMesh.value.length; i += 1) {
    listMesh.value[i].geometry.dispose();
    (listMesh.value[i].material as THREE.MeshBasicMaterial).dispose();
  }
  for (let i = 0; i < listTexture.length; i += 1) {
    listTexture[i].dispose();
  }
});

// Breathing animation loop — gentle opacity pulse
const { onBeforeRender } = useLoop();
let elapsedTime = 0;

onBeforeRender(({ delta }) => {
  elapsedTime += delta;

  for (let i = 0; i < listMaterial.length; i += 1) {
    const config = listConfig[i];
    if (config.breathSpeed <= 0) { continue; }

    // Each nebula breathes at its own speed with a phase offset
    const phase = elapsedTime * config.breathSpeed + i * 1.7;
    const breathOffset = Math.sin(phase) * config.breathRange;
    listMaterial[i].opacity = config.opacity + breathOffset;
  }

  // Rotate the entire nebula group like a real galaxy
  nebulaGroup.value.rotation.z = elapsedTime * GALAXY_ROTATION_SPEED;

  // Slow rotation drift for wisps (relative to group rotation)
  for (let i = 0; i < listMesh.value.length; i += 1) {
    const config = listConfig[i];
    if (config.isWisp) {
      listMesh.value[i].rotation.z = config.rotationZ + elapsedTime * 0.003 * (i % 2 === 0 ? 1 : -1);
    }
  }
});
</script>

<template>
  <primitive :object="nebulaGroup" />
</template>
