import { computed } from "vue";
import { useGalaxyStore } from "@/stores/galaxy";
import type { TLodTier } from "@/types";

export const useLOD = () => {
  const galaxyStore = useGalaxyStore();

  const lodTier = computed<TLodTier>(() => galaxyStore.lodTier);

  // Whether star labels should be visible (only at mid/close zoom)
  const showLabels = computed(() => lodTier.value !== "far");

  // Whether hover detection should be active (mid/close only)
  const enableHover = computed(() => lodTier.value !== "far");

  // Whether constellation lines should be visible
  const showConstellations = computed(() => lodTier.value !== "far");

  // Target particle count based on LOD tier — reduce at far zoom for performance
  const particleCount = computed(() => {
    if (lodTier.value === "far") {
      return 1500;
    }
    return 3000;
  });

  // Minimum vote_count a star must have to render its label.
  // Thresholds are intentionally high to avoid showing all 9111 labels at once.
  const labelVoteThreshold = computed(() => {
    if (lodTier.value === "close") {
      return 50;
    } // top ~200 most-voted songs
    if (lodTier.value === "mid") {
      return 150;
    } // top ~50 most-voted songs
    return Infinity; // no labels at far
  });

  // Maximum number of labels to display on screen at once
  const labelMaxCount = computed(() => {
    if (lodTier.value === "close") {
      return 40;
    }
    if (lodTier.value === "mid") {
      return 30;
    }
    return 0;
  });

  return {
    lodTier,
    showLabels,
    enableHover,
    showConstellations,
    particleCount,
    labelVoteThreshold,
    labelMaxCount,
  };
};
