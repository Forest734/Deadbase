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

const app = express();
app.disable("x-powered-by");
app.use(express.static(new URL("../public", import.meta.url).pathname));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api", (_req, res) => {
  res.json({ service: "deadbase", version: "0.1.0", source: getSource() });
});

app.get("/api/years", (_req, res) => {
  res.json(getYears());
});

app.get("/api/shows", (req, res) => {
  const { year, from, to, song, segue, venue, city, state, country, q } = req.query;
  res.json(findShows({ year, from, to, song, segue, venue, city, state, country, q }));
});

app.get("/api/shows/:id", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "show not found" });
  res.json({ ...summary(show), sets: show.sets, ...getNeighbors(show.id) });
});

app.get("/api/stats", (req, res) => {
  const { from, to } = req.query;
  res.json(getStats({ from, to }));
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
