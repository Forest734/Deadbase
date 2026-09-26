import { readFileSync } from "node:fs";

// Built by scripts/import-gdshowsdb.js; sorted by id, which sorts by date.
const { source, shows } = JSON.parse(
  readFileSync(new URL("../data/shows.json", import.meta.url), "utf8"),
);

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// The source has no encore flag. A short final set after the main sets is
// almost always the encore, so label it that way.
function setLabels(sets) {
  return sets.map((songs, i) => {
    const last = i === sets.length - 1;
    return last && sets.length > 1 && songs.length <= 3 ? "Encore" : `Set ${i + 1}`;
  });
}

const showsById = new Map();
const songsBySlug = new Map();

for (const show of shows) {
  show.year = Number(show.date.slice(0, 4));
  const labels = setLabels(show.sets);
  show.sets = show.sets.map((songs, i) => ({
    label: labels[i],
    songs: songs.map((s) => ({ ...s, slug: slugify(s.name) })),
  }));
  showsById.set(show.id, show);

  for (const set of show.sets) {
    for (const song of set.songs) {
      let entry = songsBySlug.get(song.slug);
      if (!entry) {
        entry = { slug: song.slug, name: song.name, showIds: [] };
        songsBySlug.set(song.slug, entry);
      }
      // A song played twice in one show (a reprise) is still one show.
      if (entry.showIds.at(-1) !== show.id) entry.showIds.push(show.id);
    }
  }
}

export function summary(show) {
  const { id, date, year, venue, city, state, country } = show;
  const songCount = show.sets.reduce((n, set) => n + set.songs.length, 0);
  return { id, date, year, venue, city, state, country, songCount };
}

export function getSource() {
  return source;
}

export function getYears() {
  const counts = new Map();
  for (const show of shows) counts.set(show.year, (counts.get(show.year) ?? 0) + 1);
  return [...counts].map(([year, count]) => ({ year, count }));
}

// Filters combine: year, song slug, and free text over venue/city/state/date.
export function findShows({ year, song, q } = {}) {
  let result = shows;
  if (year) result = result.filter((s) => s.year === Number(year));
  if (song) {
    const ids = new Set(songsBySlug.get(song)?.showIds ?? []);
    result = result.filter((s) => ids.has(s.id));
  }
  if (q) {
    const needle = q.trim().toLowerCase();
    result = result.filter((s) =>
      [s.date, s.venue, s.city, s.state, s.country].some((f) => f?.toLowerCase().includes(needle)),
    );
  }
  return result.map(summary);
}

export function getShow(id) {
  return showsById.get(id);
}

// Ids of the chronologically adjacent shows, for prev/next navigation.
export function getNeighbors(id) {
  const i = shows.findIndex((s) => s.id === id);
  return { prev: shows[i - 1]?.id ?? null, next: shows[i + 1]?.id ?? null };
}

export function getSongs() {
  return [...songsBySlug.values()]
    .map(({ slug, name, showIds }) => ({
      slug,
      name,
      count: showIds.length,
      first: showIds[0],
      last: showIds.at(-1),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getSong(slug) {
  const entry = songsBySlug.get(slug);
  if (!entry) return undefined;
  return {
    slug,
    name: entry.name,
    count: entry.showIds.length,
    shows: entry.showIds.map((id) => summary(showsById.get(id))),
  };
}
