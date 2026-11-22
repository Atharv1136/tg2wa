import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  outExtension() {
    return {
      js: ".js",
    };
  },
  noExternal: ["@tg2wa/db", "@tg2wa/shared"],
});
