import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import "./style.css";
import App from "./App.vue";

const app = createApp(App);

// Suppress Vue warnings for TresJS components (Tres*, primitive).
// These components are resolved at runtime inside TresCanvas's custom
// renderer, not via Vue's global component registry. The warnings are
// harmless but noisy.
//
// NOTE: compilerOptions.isCustomElement does NOT work in Vite dev mode
// (runtime-only build) and generates its own warning. Instead we use
// warnHandler to silently drop the "Failed to resolve component" messages.
app.config.warnHandler = (msg) => {
  if (msg.includes("Failed to resolve component")) {
    return;
  }
  if (msg.includes("compilerOptions")) {
    return;
  }
  console.warn(msg);
};

app.use(createPinia());
app.use(router);
app.mount("#app");
