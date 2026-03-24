import { createRouter, createWebHistory } from "vue-router";

const GalaxyView = () => import("@/views/GalaxyView.vue");
const ChangelogView = () => import("@/views/ChangelogView.vue");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "galaxy", component: GalaxyView },
    { path: "/song/:id", name: "song", component: GalaxyView },
    { path: "/changelogs", name: "changelogs", component: ChangelogView },
  ],
});

export default router;
