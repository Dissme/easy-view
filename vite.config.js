import { defineConfig } from "vite";
import babel from "vite-plugin-babel";

export default defineConfig({
  base: "./",
  plugins: [babel()]
});
