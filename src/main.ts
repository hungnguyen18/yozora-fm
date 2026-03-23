import { createApp } from "vue";
import { createPinia } from "pinia";
import "./style.css";
import App from "./App.vue";

const app = createApp(App);

// Suppress Vue warnings for TresJS components (Tres*, primitive).
// These components are resolved at runtime inside TresCanvas, not via
// Vue's global component registry. The runtime isCustomElement check
// tells Vue to treat them as custom elements so it skips the
// "Failed to resolve component" warning without affecting TresJS.
const TRES_COMPONENT_RE = /^(Tres|primitive$)/;
app.config.compilerOptions.isCustomElement = (tag: string) => {
  return TRES_COMPONENT_RE.test(tag);
};

app.use(createPinia());
app.mount("#app");
