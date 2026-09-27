// The JSON API as a plain function of a path and a query, so the Express app
// and the GitHub Pages build, which has no server and runs this in the
// browser (static/api.js), answer every request the same way.
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

export const VERSION = "0.1.0";

// The show filters that /api/shows, /api/years and /api/stats all accept.
const filters = ({ year, from, to, song, segue, venue, city, state, country, q }) =>
  ({ year, from, to, song, segue, venue, city, state, country, q });

function route(name, arg, query) {
  if (arg === undefined) {
    switch (name) {
      case "": return { service: "deadbase", version: VERSION, source: getSource() };
      case "years": return getYears(filters(query));
      case "shows": return findShows(filters(query), { sets: query.sets === "1" });
      case "stats": return getStats(filters(query));
      case "songs": return getSongs();
    }
  } else if (name === "shows") {
    const show = getShow(arg);
    return show && { ...summary(show), sets: show.sets, ...getNeighbors(show.id) };
  } else if (name === "songs") {
    return getSong(arg);
  }
}

// `path` is what follows "/api/", still URL-encoded, such as
// "shows/1977-05-08"; `query` is the parsed query string. Returns
// { status, body }, where body is what the API sends as JSON.
export function handle(path, query = {}) {
  let body;
  try {
    const [name, arg, ...extra] = path.replace(/\/$/, "").split("/").map(decodeURIComponent);
    if (!extra.length) body = route(name, arg, query);
  } catch (err) {
    if (!(err instanceof URIError)) throw err; // a malformed %-escape is just a missing page
  }
  return body === undefined ? { status: 404, body: { error: "not found" } } : { status: 200, body };
}
