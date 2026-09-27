// Builds the static GitHub Pages site into dist/: the front end from public/,
// with public/api.js swapped for static/api.js, which runs the API in the
// browser, plus the modules and data that needs.
import { cpSync, rmSync } from "node:fs";

const root = new URL("../", import.meta.url);
const out = new URL("dist/", root);

rmSync(out, { recursive: true, force: true });
cpSync(new URL("public/", root), out, { recursive: true });
cpSync(new URL("static/api.js", root), new URL("api.js", out));
for (const file of ["src/api.js", "src/data.js", "data/shows.json"]) {
  cpSync(new URL(file, root), new URL(file, out));
}
console.log(`built ${out.pathname}`);
