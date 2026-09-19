// Entry point for the CDN build (corsfix.js). Exposes the SDK as `window.corsfix`.
import corsfix from "./index.js";

globalThis.corsfix = corsfix;
