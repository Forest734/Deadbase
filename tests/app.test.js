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
