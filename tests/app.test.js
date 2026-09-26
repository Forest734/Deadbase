import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => server.close());

const get = async (path) => {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, body: res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text() };
};

test("health check", async () => {
  const { status, body } = await get("/health");
  assert.equal(status, 200);
  assert.deepEqual(body, { status: "ok" });
});

test("serves the frontend", async () => {
  const { status, body } = await get("/");
  assert.equal(status, 200);
  assert.match(body, /<h1>Deadbase<\/h1>/);
});

test("years span the band's career", async () => {
  const { body } = await get("/api/years");
  assert.equal(body[0].year, 1965);
  assert.equal(body.at(-1).year, 1995);
  assert.ok(body.reduce((n, y) => n + y.count, 0) > 2000);
});

test("Cornell '77 setlist, with segues and an encore", async () => {
  const { status, body } = await get("/api/shows/1977-05-08");
  assert.equal(status, 200);
  assert.match(body.venue, /Barton Hall/);
  assert.deepEqual(body.sets.map((s) => s.label), ["Set 1", "Set 2", "Encore"]);
  const scarlet = body.sets[1].songs[0];
  assert.equal(scarlet.name, "Scarlet Begonias");
  assert.equal(scarlet.segue, true);
  assert.equal(body.sets[1].songs[1].slug, "fire-on-the-mountain");
  assert.ok(body.prev < body.id && body.next > body.id);
});

test("unknown show is a 404", async () => {
  assert.equal((await get("/api/shows/1999-01-01")).status, 404);
});

test("filters shows by year, song and text", async () => {
  const y77 = (await get("/api/shows?year=1977")).body;
  assert.ok(y77.length > 50 && y77.every((s) => s.year === 1977));

  const ithaca = (await get("/api/shows?q=ithaca")).body;
  assert.ok(ithaca.some((s) => s.id === "1977-05-08"));

  const morningDew77 = (await get("/api/shows?year=1977&song=morning-dew")).body;
  assert.ok(morningDew77.some((s) => s.id === "1977-05-08"));
});

test("song index and song detail", async () => {
  const songs = (await get("/api/songs")).body;
  const dew = songs.find((s) => s.slug === "morning-dew");
  assert.ok(dew.count > 100);

  const { body } = await get("/api/songs/morning-dew");
  assert.equal(body.name, "Morning Dew");
  assert.equal(body.shows.length, body.count);
  assert.equal((await get("/api/songs/no-such-song")).status, 404);
});

test("filters shows by date range, place, venue and segue", async () => {
  const may77 = (await get("/api/shows?from=1977-05&to=1977-05")).body;
  assert.ok(may77.length > 10 && may77.every((s) => s.date.startsWith("1977-05")));

  const brent = (await get("/api/shows?from=1979-04-22&to=1990-07-23")).body;
  assert.equal(brent[0].id, "1979-04-22");
  assert.equal(brent.at(-1).id, "1990-07-23");

  const ca77 = (await get("/api/shows?country=US&state=CA&year=1977")).body;
  assert.ok(ca77.length > 0 && ca77.every((s) => s.state === "CA"));

  const winterland = (await get("/api/shows?venue=Winterland&city=San+Francisco")).body;
  assert.ok(winterland.length > 50 && winterland.every((s) => s.venue === "Winterland"));

  const scarletFire = (await get("/api/shows?segue=scarlet-begonias,fire-on-the-mountain")).body;
  assert.ok(scarletFire.some((s) => s.id === "1977-05-08"));
  const backwards = (await get("/api/shows?segue=fire-on-the-mountain,scarlet-begonias")).body;
  assert.ok(backwards.length < scarletFire.length);
});

test("years include per-month counts", async () => {
  const { body } = await get("/api/years");
  for (const y of body) {
    assert.equal(y.months.length, 12);
    assert.equal(y.months.reduce((a, b) => a + b, 0), y.count);
  }
});

test("stats for the whole career", async () => {
  const { status, body } = await get("/api/stats");
  assert.equal(status, 200);
  assert.equal(body.first, "1965-05-05");
  assert.equal(body.last, "1995-07-09");
  assert.ok(body.totals.shows > 2000 && body.totals.setlists < body.totals.shows);
  // Drums and Space are segments, not songs, so they stay out of the rankings.
  assert.ok(!body.rotation.songs.some((s) => s.slug === "drums" || s.slug === "space"));
  assert.equal(body.rotation.buckets.length, 31);
  assert.equal(body.segues[0].from.slug, "china-cat-sunflower");
  assert.equal(body.segues[0].to.slug, "i-know-you-rider");
  assert.ok(body.states.find((s) => s.state === "CA").shows > 800);
  assert.equal(body.records.venueRun.venue, "Warfield Theatre");
});

test("stats for one year use months, and an empty range is empty", async () => {
  const { body } = await get("/api/stats?from=1977&to=1977");
  assert.equal(body.totals.shows, 60);
  assert.equal(body.rotation.buckets[0].key, "1977-02");
  // Every rotation cell is a subset of the shows counted in its bucket.
  for (const song of body.rotation.songs) {
    song.cells.forEach((n, i) => assert.ok(n <= body.rotation.buckets[i].shows));
  }
  const none = (await get("/api/stats?from=2001")).body;
  assert.equal(none.totals.shows, 0);
  assert.deepEqual(none.rotation, { buckets: [], songs: [] });
  assert.equal(none.records.longestSetlist, null);
});

test("years and stats take the same filters as shows", async () => {
  const winterland = "venue=Winterland&city=San+Francisco";
  const shows = (await get(`/api/shows?${winterland}`)).body;
  const years = (await get(`/api/years?${winterland}`)).body;
  // Every year of the career, with zeros, so charts line up.
  assert.equal(years.length, 31);
  assert.equal(years.reduce((n, y) => n + y.count, 0), shows.length);
  assert.equal(years.find((y) => y.year === 1990).count, 0);

  const stats = (await get(`/api/stats?${winterland}`)).body;
  assert.equal(stats.totals.shows, shows.length);
  assert.equal(stats.totals.venues, 1);
  // Rotation columns are only years that had shows there.
  assert.ok(!stats.rotation.buckets.some((b) => b.key === "1976"));
  // A run counts consecutive shows in the band's history, not consecutive
  // shows in the filtered list: Winterland's longest is October 1974.
  assert.equal(stats.records.venueRun.shows, 5);
  assert.equal(stats.records.venueRun.first, "1974-10-16");

  const oregonBrent = (await get("/api/stats?state=OR&from=1979-04-22&to=1990-07-23")).body;
  const oregonBrentShows = (await get("/api/shows?state=OR&from=1979-04-22&to=1990-07-23")).body;
  assert.equal(oregonBrent.totals.shows, oregonBrentShows.length);
  assert.deepEqual(oregonBrent.states.map((s) => s.state), ["OR"]);
});
