// Built by scripts/import-gdshowsdb.js; sorted by id, which sorts by date.
// Imported rather than read from disk, so this module also runs in the
// browser for the GitHub Pages build (see src/api.js).
import data from "../data/shows.json" with { type: "json" };

const { source, shows } = data;

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

// Shows per year for every year of the band's career, including years with
// none that match the filters (see filterShows). `months` counts shows per
// calendar month, January first.
export function getYears(filters) {
  const years = new Map();
  for (let year = shows[0].year; year <= shows.at(-1).year; year++) {
    years.set(year, { year, count: 0, months: Array(12).fill(0) });
  }
  for (const show of filterShows(filters)) {
    const y = years.get(show.year);
    y.count++;
    y.months[Number(show.date.slice(5, 7)) - 1]++;
  }
  return [...years.values()];
}

// `from` and `to` are inclusive ISO date prefixes: "1977", "1977-05" or "1977-05-08".
function inRange(date, from, to) {
  return (!from || date >= from) && (!to || date <= `${to}\uffff`);
}

// True if song slug `a` segues straight into `b` somewhere in the show.
function hasSegue(show, a, b) {
  return show.sets.some((set) =>
    set.songs.some((s, i) => s.segue && s.slug === a && set.songs[i + 1]?.slug === b),
  );
}

// Filters combine: year, from/to date range, song slug, segue ("slugA,slugB"),
// exact venue/city/state/country, and free text over venue/city/state/date.
function filterShows({ year, from, to, song, segue, venue, city, state, country, q } = {}) {
  let result = shows;
  if (year) result = result.filter((s) => s.year === Number(year));
  if (from || to) result = result.filter((s) => inRange(s.date, from, to));
  if (song) {
    const ids = new Set(songsBySlug.get(song)?.showIds ?? []);
    result = result.filter((s) => ids.has(s.id));
  }
  if (segue) {
    const [a, b] = String(segue).split(",");
    result = result.filter((s) => hasSegue(s, a, b));
  }
  for (const [field, value] of Object.entries({ venue, city, state, country })) {
    if (value) result = result.filter((s) => s[field] === value);
  }
  if (q) {
    const needle = q.trim().toLowerCase();
    result = result.filter((s) =>
      [s.date, s.venue, s.city, s.state, s.country].some((f) => f?.toLowerCase().includes(needle)),
    );
  }
  return result;
}

// With `sets`, each summary also carries the show's setlist.
export function findShows(filters, { sets = false } = {}) {
  return filterShows(filters).map((show) => (sets ? { ...summary(show), sets: show.sets } : summary(show)));
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

// Drums, Space and the untitled Jam are segments of a show rather than songs.
// They would top every ranking, so the stats leave them out.
const SEGMENTS = new Set(["drums", "space", "jam"]);

// Each show's position among the shows with a setlist, for "shows since last played".
const setlistIndex = new Map(shows.filter((s) => s.sets.length).map((s, i) => [s.id, i]));

const tally = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
// The n biggest counts. Ties keep first-seen, which is chronological, order.
const top = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n);
const songRef = (slug) => ({ slug, name: songsBySlug.get(slug).name });
const ranked = ([slug, shows]) => ({ ...songRef(slug), shows });

// Aggregates over the shows that match the filters (see filterShows).
export function getStats(filters) {
  const scoped = filterShows(filters);
  const inScope = new Set(scoped.map((s) => s.id));
  const played = scoped.filter((s) => s.sets.length);

  // Rotation columns are years, or months when the range sits inside one year.
  const byMonth = scoped.length > 0 && scoped[0].year === scoped.at(-1).year;
  const bucketOf = (s) => (byMonth ? s.date.slice(0, 7) : String(s.year));

  const songShows = new Map();
  const songBuckets = new Map(); // "slug bucket" -> shows
  const bucketShows = new Map();
  const openers = new Map();
  const setTwoOpeners = new Map();
  const encores = new Map();
  const segues = new Map(); // "slugA,slugB" -> shows
  let entries = 0;
  let longestSetlist = null;
  let longestSegue = null;

  for (const show of played) {
    const bucket = bucketOf(show);
    tally(bucketShows, bucket);
    const songs = show.sets.flatMap((set) => set.songs);
    entries += songs.length;
    if (songs.length > (longestSetlist?.songCount ?? 0)) longestSetlist = summary(show);

    for (const slug of new Set(songs.map((s) => s.slug))) {
      if (SEGMENTS.has(slug)) continue;
      tally(songShows, slug);
      tally(songBuckets, `${slug} ${bucket}`);
    }
    if (!SEGMENTS.has(songs[0].slug)) tally(openers, songs[0].slug);
    const second = show.sets.find((set) => set.label === "Set 2");
    if (second && !SEGMENTS.has(second.songs[0].slug)) tally(setTwoOpeners, second.songs[0].slug);
    const encore = show.sets.find((set) => set.label === "Encore");
    if (encore) {
      for (const slug of new Set(encore.songs.map((s) => s.slug))) if (!SEGMENTS.has(slug)) tally(encores, slug);
    }

    // Segue pairs count once per show; a run is songs joined by consecutive segues.
    const pairs = new Set();
    for (const set of show.sets) {
      let start = 0;
      set.songs.forEach((song, i) => {
        const next = set.songs[i + 1];
        if (song.segue && next) {
          if (!SEGMENTS.has(song.slug) && !SEGMENTS.has(next.slug)) pairs.add(`${song.slug},${next.slug}`);
          return;
        }
        if (i - start + 1 > Math.max(1, longestSegue?.songs.length ?? 0)) {
          const run = set.songs.slice(start, i + 1).map(({ slug, name }) => ({ slug, name }));
          longestSegue = { ...summary(show), songs: run };
        }
        start = i + 1;
      });
    }
    for (const pair of pairs) tally(segues, pair);
  }

  // Each year (or month) with a show in scope, including shows without setlists.
  const buckets = [...new Set(scoped.map(bucketOf))];

  const catalog = [...songsBySlug.values()].filter((e) => !SEGMENTS.has(e.slug));
  let bustout = null;
  for (const { slug, name, showIds } of catalog) {
    for (let i = 1; i < showIds.length; i++) {
      if (!inScope.has(showIds[i])) continue;
      const gap = setlistIndex.get(showIds[i]) - setlistIndex.get(showIds[i - 1]) - 1;
      if (gap > (bustout?.gap ?? 0)) {
        bustout = { slug, name, gap, prev: showIds[i - 1], show: summary(showsById.get(showIds[i])) };
      }
    }
  }

  const venues = new Map(); // "venue|city" -> shows
  const venueShow = new Map();
  const states = new Map();
  const countries = new Map();
  for (const show of scoped) {
    const key = `${show.venue}|${show.city}`;
    tally(venues, key);
    if (!venueShow.has(key)) venueShow.set(key, show);
    tally(show.country === "US" ? states : countries, show.country === "US" ? show.state : show.country);
  }

  // A run is consecutive shows at one venue in the band's whole history (so a
  // venue's own stats don't count all its shows as one run); only shows in
  // scope count towards it.
  let venueRun = null;
  let run = [];
  shows.forEach((show, i) => {
    if (inScope.has(show.id)) run.push(show);
    const next = shows[i + 1];
    if (next && next.venue === show.venue && next.city === show.city) return;
    if (run.length > (venueRun?.shows ?? 1)) {
      const { venue, city, state, country } = show;
      venueRun = { venue, city, state, country, shows: run.length, first: run[0].date, last: run.at(-1).date };
    }
    run = [];
  });

  return {
    first: scoped[0]?.date ?? null,
    last: scoped.at(-1)?.date ?? null,
    totals: {
      shows: scoped.length,
      setlists: played.length,
      songs: songShows.size,
      debuts: catalog.filter((e) => inScope.has(e.showIds[0])).length,
      venues: venues.size,
      years: new Set(scoped.map((s) => s.year)).size,
      songsPerShow: played.length ? Math.round((entries / played.length) * 10) / 10 : 0,
    },
    rotation: {
      buckets: buckets.map((key) => ({ key, shows: bucketShows.get(key) ?? 0 })),
      songs: top(songShows, 20).map(([slug, n]) => ({
        ...songRef(slug),
        shows: n,
        cells: buckets.map((b) => songBuckets.get(`${slug} ${b}`) ?? 0),
      })),
    },
    segues: top(segues, 10).map(([pair, n]) => {
      const [a, b] = pair.split(",");
      return { from: songRef(a), to: songRef(b), shows: n };
    }),
    openers: top(openers, 8).map(ranked),
    setTwoOpeners: top(setTwoOpeners, 8).map(ranked),
    encores: top(encores, 8).map(ranked),
    venues: top(venues, 10).map(([key, n]) => {
      const { venue, city, state, country } = venueShow.get(key);
      return { venue, city, state, country, shows: n };
    }),
    states: [...states].map(([state, n]) => ({ state, shows: n })),
    countries: top(countries, Infinity).map(([country, n]) => ({ country, shows: n })),
    records: { longestSetlist, longestSegue, bustout, venueRun },
  };
}
