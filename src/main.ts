import { createApp } from "vue";
import { createPinia } from "pinia";
import "./style.css";
import App from "./App.vue";

const app = createApp(App);

// Suppress Vue warnings for TresJS components (Tres*, primitive).
// These components are resolved at runtime inside TresCanvas, not via
// Vue's global component registry.
//
// NOTE: We intentionally do NOT add isCustomElement to vite.config.ts
// because doing so tells the Vue template compiler to treat these tags
// as native custom elements, which prevents TresJS from resolving them
// inside its own renderer — breaking 3D rendering entirely.
//
// Runtime isCustomElement helps in dev mode; warnHandler catches the
// remaining "Failed to resolve component" warnings in production builds.
app.config.compilerOptions.isCustomElement = (tag: string) => {
  return tag === "primitive" || tag.startsWith("Tres");
};

app.config.warnHandler = (msg, _vm, _trace) => {
  if (msg.includes("Failed to resolve component")) {
    return;
  }
  console.warn(msg);
};

app.use(createPinia());
app.mount("#app");
