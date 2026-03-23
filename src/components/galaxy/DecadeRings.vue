<script setup lang="ts">
// DecadeRings — draws subtle circular ring outlines and text labels at each
// decade boundary in the galaxy spiral (1980s outer, 2020s inner).
// Must be placed inside a TresCanvas.

import { onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { useTresContext } from '@tresjs/core';

const { scene } = useTresContext();

const R_MAX = 500;
const TOTAL_SPAN_YEARS = 46;
const RING_SEGMENTS = 128;

const LIST_DECADE = [
  { year: 1980, label: '80s' },
  { year: 1990, label: '90s' },
  { year: 2000, label: '00s' },
  { year: 2010, label: '10s' },
  { year: 2020, label: '20s' },
];

const ringGroup = new THREE.Group();
ringGroup.name = 'DecadeRings';

const buildRings = () => {
  const ringMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(0x4f46e5),
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
  });

  for (let i = 0; i < LIST_DECADE.length; i += 1) {
    const decade = LIST_DECADE[i];
    const radius = R_MAX * (1 - (decade.year - 1980) / TOTAL_SPAN_YEARS);

    // Ring circle geometry
    const listPoint: THREE.Vector3[] = [];
    for (let j = 0; j <= RING_SEGMENTS; j += 1) {
      const theta = (j / RING_SEGMENTS) * Math.PI * 2;
      listPoint.push(new THREE.Vector3(
        radius * Math.cos(theta),
        radius * Math.sin(theta),
        -0.1, // slightly behind stars
      ));
    }

    const ringGeometry = new THREE.BufferGeometry().setFromPoints(listPoint);
    const ringLine = new THREE.Line(ringGeometry, ringMaterial);
    ringGroup.add(ringLine);

    // Text label using canvas texture on a sprite
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 128;
    labelCanvas.height = 48;
    const ctx = labelCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 48);
    ctx.font = '600 28px "Space Grotesk", sans-serif';
    ctx.fillStyle = 'rgba(155, 155, 180, 0.45)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(decade.label, 64, 24);

    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      sizeAttenuation: false,
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    // Position label at the top of the ring
    sprite.position.set(0, radius + 8, -0.1);
    // Scale: in NDC-like units since sizeAttenuation is false
    sprite.scale.set(0.06, 0.022, 1);
    ringGroup.add(sprite);
  }
};

onMounted(() => {
  buildRings();
  scene.value.add(ringGroup);
});

onUnmounted(() => {
  scene.value.remove(ringGroup);

  // Dispose geometries and materials
  ringGroup.traverse((child) => {
    if (child instanceof THREE.Line) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
    if (child instanceof THREE.Sprite) {
      (child.material as THREE.SpriteMaterial).map?.dispose();
      child.material.dispose();
    }
  });
});
</script>

<template>
  <!-- DecadeRings renders directly into the Three.js scene via imperative API -->
</template>
