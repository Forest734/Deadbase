// Converts gdshowsdb's per-year YAML (https://github.com/jefmsmit/gdshowsdb,
// MIT) into data/shows.json, the only data file the app reads.
//
//   git clone --depth 1 https://github.com/jefmsmit/gdshowsdb /tmp/gdshowsdb
//   npm run import -- /tmp/gdshowsdb
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { load as loadYaml } from "js-yaml";

const repo = process.argv[2];
if (!repo) {
  console.error("usage: npm run import -- <path to gdshowsdb clone>");
  process.exit(1);
}

const dataDir = join(repo, "data", "gdshowsdb");
const yearFiles = readdirSync(dataDir).filter((f) => /^\d{4}\.yaml$/.test(f)).sort();

const shows = [];
for (const file of yearFiles) {
  const doc = loadYaml(readFileSync(join(dataDir, file), "utf8"));
  for (const [key, show] of Object.entries(doc)) {
    // Keys are "YYYY/MM/DD", or "YYYY/MM/DD/N" when there were several shows that day.
    const [y, m, d, n] = key.split("/");
    const date = `${y}-${m}-${d}`;
    shows.push({
      id: n === undefined ? date : `${date}-${n}`,
      date,
      venue: show[":venue"],
      city: show[":city"],
      state: show[":state"] ?? null,
      country: show[":country"],
      sets: (show[":sets"] ?? []).map((set) =>
        (set[":songs"] ?? []).map((song) => ({
          name: song[":name"],
          segue: song[":segued"] === true,
        })),
      ),
    });
  }
}
shows.sort((a, b) => a.id.localeCompare(b.id));

let source;
try {
  source = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  source = null;
}

const out = {
  source: { repo: "https://github.com/jefmsmit/gdshowsdb", commit: source, license: "MIT" },
  shows,
};
writeFileSync(new URL("../data/shows.json", import.meta.url), JSON.stringify(out) + "\n");
console.log(`wrote ${shows.length} shows to data/shows.json`);
