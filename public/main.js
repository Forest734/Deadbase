// Hash router: #/, #/year/1977, #/show/1977-05-08, #/songs, #/song/<slug>,
// #/search?q=..., #/stats?<filters>, and #/shows?<filters>, where <filters> are
// any of the /api/shows filters.
import { api, esc, formatDate, formatDay, pageTitle, place, showList, sortableTable, sortTable } from "./lib.js";
import { describeFilters, statsPage, wireStats } from "./stats.js";

const view = document.getElementById("view");

const routes = {
  async home() {
    const years = await api("years");
    const total = years.reduce((n, y) => n + y.count, 0);
    const heading = `<h2>${total.toLocaleString()} shows, ${years[0].year}–${years.at(-1).year}</h2>`;
    return `${pageTitle(heading, `<p class="lede">Pick a year to see its shows.</p>`)}
      <ul class="years">${years
        .map((y) => `<li><a href="#/year/${y.year}"><strong>${y.year}</strong><span>${y.count} shows</span></a></li>`)
        .join("")}</ul>`;
  },

  async year(year) {
    const shows = await api(`shows?year=${encodeURIComponent(year)}`);
    const y = Number(year);
    return `<p class="pager">
        <a href="#/year/${y - 1}">← ${y - 1}</a>
        <a href="#/year/${y + 1}">${y + 1} →</a>
      </p>
      ${pageTitle(
        `<h2>${esc(year)} <span class="muted">· ${shows.length} shows</span></h2>`,
        shows.length ? `<p class="lede">${esc(formatDay(shows[0].date))} to ${esc(formatDay(shows.at(-1).date))}</p>` : "",
      )}
      ${showList(shows)}`;
  },

  async show(id) {
    const s = await api(`shows/${encodeURIComponent(id)}`);
    if (!s) return `<h2>Show not found</h2>`;
    const sets = s.sets.length
      ? s.sets
          .map(
            (set) => `<section class="set"><h3>${esc(set.label)}</h3><ol>${set.songs
              .map((song) => `<li><a href="#/song/${esc(song.slug)}">${esc(song.name)}</a>${song.segue ? ` <span class="segue" title="segues into next song">&gt;</span>` : ""}</li>`)
              .join("")}</ol></section>`,
          )
          .join("")
      : `<p class="muted">No setlist is recorded for this show.</p>`;
    return `<p class="pager">
        ${s.prev ? `<a href="#/show/${esc(s.prev)}">← previous show</a>` : "<span></span>"}
        <a href="#/year/${s.year}">${s.year}</a>
        ${s.next ? `<a href="#/show/${esc(s.next)}">next show →</a>` : "<span></span>"}
      </p>
      ${pageTitle(`<h2>${esc(formatDate(s.date))}</h2>`, `<p class="lede">${esc(s.venue)} · ${esc(place(s))}</p>`)}
      <div class="sets">${sets}</div>`;
  },

  async songs() {
    const songs = await api("songs");
    const showLink = (id) => `<a href="#/show/${esc(id)}">${esc(formatDay(id))}</a>`;
    return `${pageTitle(`<h2>${songs.length} songs</h2>`, `<p class="lede">Click a column heading to sort, or filter by name.</p>`)}
      <input id="song-filter" type="search" placeholder="Filter songs" aria-label="Filter songs">
      ${sortableTable(
        [
          { label: "Song", cell: (s) => `<a href="#/song/${esc(s.slug)}">${esc(s.name)}</a>`, sort: (s) => s.name },
          { label: "Shows", num: true, cell: (s) => s.count, sort: (s) => s.count },
          { label: "First", cell: (s) => showLink(s.first), sort: (s) => s.first },
          { label: "Last", cell: (s) => showLink(s.last), sort: (s) => s.last },
        ],
        songs,
        { cls: "songs", rowAttrs: (s) => `data-name="${esc(s.name.toLowerCase())}"` },
      )}`;
  },

  async song(slug) {
    const s = await api(`songs/${encodeURIComponent(slug)}`);
    if (!s) return `<h2>Song not found</h2>`;
    const dates = `${esc(formatDay(s.shows[0].date))} to ${esc(formatDay(s.shows.at(-1).date))}`;
    return `${pageTitle(`<h2>${esc(s.name)}</h2>`, `<p class="lede">Played at ${s.count} shows, ${dates}.</p>`)}
      ${showList(s.shows)}`;
  },

  async search(_arg, params) {
    const q = params.get("q") ?? "";
    const shows = await api(`shows?q=${encodeURIComponent(q)}`);
    return `<h2>Shows matching “${esc(q)}” <span class="muted">· ${shows.length}</span></h2>${showList(shows)}`;
  },

  stats: (_arg, params) => statsPage(params),

  // Where the stats page drills down to; takes any /api/shows filter.
  async shows(_arg, params) {
    const [shows, title] = await Promise.all([api(`shows?${params}`), describeFilters(params)]);
    return `<h2>${esc(title)} <span class="muted">· ${shows.length} shows</span></h2>${showList(shows)}`;
  },
};

let renders = 0;
let lastPath = null;

async function render() {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [name, arg] = path.split("/").map(decodeURIComponent);
  const route = routes[name || "home"];
  const current = ++renders;
  // The old page stays up, dimmed, until the new one is ready.
  view.classList.add("loading");
  let html;
  try {
    html = route ? await route(arg, new URLSearchParams(query)) : `<h2>Page not found</h2>`;
  } catch (err) {
    html = `<h2>Something went wrong</h2><p class="muted">${esc(err.message)}</p>`;
  }
  if (current !== renders) return; // a later navigation won
  view.innerHTML = html;
  view.classList.remove("loading");
  // Changing only the query (a new stats range) keeps the scroll position.
  if (path !== lastPath) window.scrollTo(0, 0);
  lastPath = path;
}

// Start over is a link home. Filters live in the URL, so leaving a page drops
// them; the search box is the one thing that keeps its text, so clear it.
document.getElementById("start-over").addEventListener("click", () => {
  document.getElementById("search").q.value = "";
  window.scrollTo(0, 0); // already home: no hashchange, so no render to scroll
});

document.getElementById("search").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = e.target.q.value.trim();
  if (q) location.hash = `#/search?q=${encodeURIComponent(q)}`;
});

view.addEventListener("input", (e) => {
  if (e.target.id !== "song-filter") return;
  const needle = e.target.value.trim().toLowerCase();
  for (const row of view.querySelectorAll("tbody tr")) {
    row.hidden = !row.dataset.name.includes(needle);
  }
});

view.addEventListener("click", (e) => {
  const button = e.target.closest("th button[data-col]");
  if (button) sortTable(button);
});

wireStats(view);
window.addEventListener("hashchange", render);
render();
