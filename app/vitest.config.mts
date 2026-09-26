import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const appDir = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");

export default defineConfig({
  resolve: {
    alias: { "@": appDir },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
