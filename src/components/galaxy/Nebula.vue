<script setup lang="ts">
// Nebula — atmospheric background planes with radial gradient textures.
// Renders behind the star field to add depth and colour to the galaxy.

import { shallowRef, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';

const createNebulaTexture = (color1: string, color2: string, size = 512): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2 + '00'); // fade to transparent at edge
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
};

type TNebulaConfig = {
  color1: string;
  color2: string;
  z: number;
  scale: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
  rotationZ: number;
};

const listNebulaConfig: TNebulaConfig[] = [
  { color1: '#4F46E5', color2: '#4F46E5', z: -50,  scale: 800, opacity: 0.15, offsetX: 0,    offsetY: 0,   rotationZ: 0 },
  { color1: '#7C3AED', color2: '#7C3AED', z: -80,  scale: 600, opacity: 0.10, offsetX: 100,  offsetY: -50, rotationZ: 0.3 },
  { color1: '#F97066', color2: '#F97066', z: -100, scale: 500, opacity: 0.05, offsetX: -80,  offsetY: 100, rotationZ: -0.2 },
];

const listMesh = shallowRef<THREE.Mesh[]>([]);
const listTexture: THREE.CanvasTexture[] = [];

onMounted(() => {
  const meshes: THREE.Mesh[] = [];

  for (let i = 0; i < listNebulaConfig.length; i += 1) {
    const config = listNebulaConfig[i];
    const texture = createNebulaTexture(config.color1, config.color2);
    listTexture.push(texture);

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: config.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(config.offsetX, config.offsetY, config.z);
    mesh.rotation.z = config.rotationZ;
    mesh.scale.setScalar(config.scale);

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
</script>

<template>
  <primitive
    v-for="(mesh, index) in listMesh"
    :key="index"
    :object="mesh"
  />
</template>
