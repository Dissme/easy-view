import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { build } from "vite";
import babel from "vite-plugin-babel";

const __dirname = dirname(fileURLToPath(import.meta.url));

const imports = [
  {
    entry: path.resolve(__dirname, "src/dom/index.js"),
    name: "easy-view"
  },
  {
    entry: path.resolve(__dirname, "src/vm/index.js"),
    name: "jsx-runtime"
  }
];

imports.forEach(async ({ entry, name }) => {
  await build({
    configFile: false,
    base: "./",
    plugins: [babel()],
    build: {
      lib: {
        entry,
        name,
        formats: ["es", "umd"],
        fileName: format => `${name}.${format}.js`
      }
    }
  });
});
