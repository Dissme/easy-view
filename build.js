import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { build } from "vite";
import babel from "vite-plugin-babel";

const __dirname = dirname(fileURLToPath(import.meta.url));

const imports = [
  { entry: path.resolve(__dirname, "src/index.js"), name: "easyView" },
  { entry: path.resolve(__dirname, "src/jsx-runtime.js"), name: "jsx-runtime" }
];

imports.forEach(async ({ entry, name }) => {
  await build({
    configFile: false,
    base: "./",
    plugins: [babel()],
    build: {
      minify: false,
      lib: {
        entry,
        name,
        formats: ["es", "umd"]
      },
      rollupOptions: {
        output: {
          assetFileNames: `${name}.[ext]`,
          entryFileNames: () => "[name].[format].js"
        }
      }
    }
  });
});
