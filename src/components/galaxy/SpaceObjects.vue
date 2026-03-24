<script setup lang="ts">
// SpaceObjects — floating space stations and rockets drifting through the galaxy.
// Pure CSS animations on HTML elements — zero Three.js overhead.
// Objects spawn at random edges and drift across the screen slowly.

import { ref, onMounted, onUnmounted } from 'vue';

type TObjectKind = 'station';

interface ISpaceObject {
  id: number;
  kind: TObjectKind;
  emoji: string;
  startX: number;     // start position (%)
  startY: number;
  endX: number;       // end position (%)
  endY: number;
  duration: number;   // seconds
  size: number;       // font-size in px
  rotateSpeed: number; // deg/s
  rotateDir: number;  // 1 or -1
  twinkle: boolean;   // pulse glow effect
}

const LIST_EMOJI = ['🛸', '🛰️'];

const listObject = ref<ISpaceObject[]>([]);
let nextId = 0;
let spawnTimer: ReturnType<typeof setTimeout> | null = null;

const randomBetween = (min: number, max: number): number => {
  return min + Math.random() * (max - min);
};

const spawnObject = (): void => {
  const kind: TObjectKind = 'station';
  const emoji = LIST_EMOJI[Math.floor(Math.random() * LIST_EMOJI.length)];
  const size = 16 + Math.random() * 14;

  // Pick start and end edges (opposite sides for traversal)
  const edge = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
  let startX: number;
  let startY: number;
  let endX: number;
  let endY: number;

  switch (edge) {
    case 0: // top → bottom
      startX = randomBetween(10, 90);
      startY = -8;
      endX = startX + randomBetween(-30, 30);
      endY = 108;
      break;
    case 1: // right → left
      startX = 108;
      startY = randomBetween(10, 80);
      endX = -8;
      endY = startY + randomBetween(-20, 20);
      break;
    case 2: // bottom → top
      startX = randomBetween(10, 90);
      startY = 108;
      endX = startX + randomBetween(-30, 30);
      endY = -8;
      break;
    default: // left → right
      startX = -8;
      startY = randomBetween(10, 80);
      endX = 108;
      endY = startY + randomBetween(-20, 20);
      break;
  }

  const duration = randomBetween(25, 55);

  const obj: ISpaceObject = {
    id: nextId++,
    kind,
    emoji,
    startX,
    startY,
    endX,
    endY,
    duration,
    size,
    rotateSpeed: kind === 'station' ? randomBetween(8, 20) : 0,
    rotateDir: Math.random() > 0.5 ? 1 : -1,
    twinkle: Math.random() > 0.5,
  };

  listObject.value.push(obj);

  // Auto-remove after animation
  setTimeout(() => {
    listObject.value = listObject.value.filter((o) => o.id !== obj.id);
  }, (obj.duration + 1) * 1000);
};

const scheduleNext = (): void => {
  // Spawn every 15-30 seconds
  const delay = 15000 + Math.random() * 15000;
  spawnTimer = setTimeout(() => {
    spawnObject();
    scheduleNext();
  }, delay);
};

onMounted(() => {
  // Single initial object after delay
  setTimeout(() => {
    spawnObject();
    scheduleNext();
  }, 5000);
});

onUnmounted(() => {
  if (spawnTimer) {
    clearTimeout(spawnTimer);
  }
});

const objectStyle = (obj: ISpaceObject): Record<string, string> => {
  return {
    '--start-x': obj.startX + '%',
    '--start-y': obj.startY + '%',
    '--end-x': obj.endX + '%',
    '--end-y': obj.endY + '%',
    '--duration': obj.duration + 's',
    '--size': obj.size + 'px',
    '--rotate-speed': obj.rotateSpeed + 'deg',
    fontSize: obj.size + 'px',
  };
};
</script>

<template>
  <div class="space-objects-layer">
    <div
      v-for="obj in listObject"
      :key="obj.id"
      class="space-object"
      :class="{
        'space-object--station': obj.kind === 'station',
        'space-object--twinkle': obj.twinkle,
      }"
      :style="objectStyle(obj)"
    >
      <span class="space-object__emoji">{{ obj.emoji }}</span>
    </div>
  </div>
</template>

<style scoped>
.space-objects-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
}

.space-object {
  position: absolute;
  left: var(--start-x);
  top: var(--start-y);
  animation: drift var(--duration) linear forwards;
  opacity: 0;
  filter: drop-shadow(0 0 4px rgba(200, 200, 255, 0.3));
  will-change: transform, opacity;
}

.space-object__emoji {
  display: inline-block;
  font-size: var(--size);
  line-height: 1;
}

/* Station: slow continuous rotation */
.space-object--station .space-object__emoji {
  animation: spin 8s linear infinite;
}

/* Twinkle: pulsing glow */
.space-object--twinkle {
  animation: drift var(--duration) linear forwards, twinkle-pulse 2s ease-in-out infinite;
}

@keyframes drift {
  0% {
    left: var(--start-x);
    top: var(--start-y);
    opacity: 0;
  }
  3% {
    opacity: 0.7;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    left: var(--end-x);
    top: var(--end-y);
    opacity: 0;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes twinkle-pulse {
  0%, 100% {
    filter: drop-shadow(0 0 3px rgba(200, 200, 255, 0.2));
  }
  50% {
    filter: drop-shadow(0 0 8px rgba(200, 200, 255, 0.6));
  }
}

</style>
