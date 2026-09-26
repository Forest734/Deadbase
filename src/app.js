import express from "express";
import {
  findShows,
  getNeighbors,
  getShow,
  getSong,
  getSongs,
  getSource,
  getStats,
  getYears,
  summary,
} from "./data.js";

// The show filters that /api/shows, /api/years and /api/stats all accept.
const filters = ({ year, from, to, song, segue, venue, city, state, country, q }) =>
  ({ year, from, to, song, segue, venue, city, state, country, q });

const app = express();
app.disable("x-powered-by");
app.use(express.static(new URL("../public", import.meta.url).pathname));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api", (_req, res) => {
  res.json({ service: "deadbase", version: "0.1.0", source: getSource() });
});

app.get("/api/years", (req, res) => {
  res.json(getYears(filters(req.query)));
});

app.get("/api/shows", (req, res) => {
  res.json(findShows(filters(req.query)));
});

app.get("/api/shows/:id", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "show not found" });
  res.json({ ...summary(show), sets: show.sets, ...getNeighbors(show.id) });
});

app.get("/api/stats", (req, res) => {
  res.json(getStats(filters(req.query)));
});

app.get("/api/songs", (_req, res) => {
  res.json(getSongs());
});

app.get("/api/songs/:slug", (req, res) => {
  const song = getSong(req.params.slug);
  if (!song) return res.status(404).json({ error: "song not found" });
  res.json(song);
});

export { app };
