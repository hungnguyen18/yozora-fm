<script setup lang="ts">
// ShootingStars — random meteor streaks that fly across the galaxy.
// Pure CSS animations on absolutely positioned elements — zero Three.js overhead.
// Each meteor has a glowing head + fading trail with randomized angle, speed, and color.

import { ref, onMounted, onUnmounted } from 'vue';

interface IShootingStar {
  id: number;
  x: number;       // start X (%)
  y: number;       // start Y (%)
  angle: number;   // travel angle (deg)
  duration: number; // animation duration (s)
  delay: number;   // initial delay (s)
  length: number;  // trail length (px)
  color: string;   // head glow color
}

const listMeteor = ref<IShootingStar[]>([]);
let nextId = 0;
let spawnTimer: ReturnType<typeof setInterval> | null = null;

const LIST_COLOR = [
  'rgba(200, 200, 255, 0.9)',  // cool white
  'rgba(180, 190, 255, 0.85)', // soft blue
  'rgba(255, 210, 180, 0.8)',  // warm amber
  'rgba(220, 180, 255, 0.85)', // soft purple
  'rgba(180, 255, 230, 0.8)',  // cyan tint
];

const spawnMeteor = (): void => {
  const edge = Math.random(); // which edge to start from
  let x: number;
  let y: number;
  let angle: number;

  if (edge < 0.4) {
    // Top edge
    x = Math.random() * 100;
    y = -5;
    angle = 30 + Math.random() * 30; // angled downward
  } else if (edge < 0.7) {
    // Right edge
    x = 105;
    y = Math.random() * 60;
    angle = 190 + Math.random() * 40;
  } else {
    // Left edge
    x = -5;
    y = Math.random() * 50;
    angle = -10 + Math.random() * 30;
  }

  const meteor: IShootingStar = {
    id: nextId++,
    x,
    y,
    angle,
    duration: 0.8 + Math.random() * 1.5,
    delay: 0,
    length: 60 + Math.random() * 120,
    color: LIST_COLOR[Math.floor(Math.random() * LIST_COLOR.length)],
  };

  listMeteor.value.push(meteor);

  // Remove after animation completes
  setTimeout(() => {
    listMeteor.value = listMeteor.value.filter((m) => m.id !== meteor.id);
  }, (meteor.duration + 0.5) * 1000);
};

onMounted(() => {
  // Spawn a meteor every 2-6 seconds
  const scheduleNext = (): void => {
    const delay = 2000 + Math.random() * 4000;
    spawnTimer = setTimeout(() => {
      spawnMeteor();
      scheduleNext();
    }, delay);
  };

  // Initial burst: 1-2 meteors after a short delay
  setTimeout(() => {
    spawnMeteor();
    scheduleNext();
  }, 1500);
});

onUnmounted(() => {
  if (spawnTimer) {
    clearTimeout(spawnTimer);
  }
});
</script>

<template>
  <div class="shooting-stars-layer">
    <div
      v-for="meteor in listMeteor"
      :key="meteor.id"
      class="meteor"
      :style="{
        left: meteor.x + '%',
        top: meteor.y + '%',
        '--meteor-angle': meteor.angle + 'deg',
        '--meteor-duration': meteor.duration + 's',
        '--meteor-length': meteor.length + 'px',
        '--meteor-color': meteor.color,
      }"
    />
  </div>
</template>

<style scoped>
.shooting-stars-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.meteor {
  position: absolute;
  width: var(--meteor-length);
  height: 2px;
  transform: rotate(var(--meteor-angle));
  transform-origin: 0% 50%;
  animation: meteor-fly var(--meteor-duration) linear forwards;
  opacity: 0;
}

.meteor::before {
  content: '';
  position: absolute;
  right: 0;
  top: -1px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--meteor-color);
  box-shadow:
    0 0 6px 2px var(--meteor-color),
    0 0 14px 4px rgba(200, 200, 255, 0.3);
}

.meteor::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    to right,
    transparent 0%,
    rgba(200, 200, 255, 0.05) 30%,
    var(--meteor-color) 100%
  );
  border-radius: 0 2px 2px 0;
}

@keyframes meteor-fly {
  0% {
    opacity: 0;
    transform: rotate(var(--meteor-angle)) translateX(0);
  }
  5% {
    opacity: 1;
  }
  70% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
    transform: rotate(var(--meteor-angle)) translateX(600px);
  }
}
</style>
