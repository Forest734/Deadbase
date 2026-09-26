// Hash router: #/, #/year/1977, #/show/1977-05-08, #/songs, #/song/<slug>, #/search?q=...
const view = document.getElementById("view");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const place = (s) => [s.city, s.state ?? s.country].filter(Boolean).join(", ");

const formatDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });

async function api(path) {
  const res = await fetch(`api/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function showList(shows) {
  if (!shows.length) return `<p class="muted">No shows found.</p>`;
  return `<ol class="shows">${shows
    .map(
      (s) => `<li><a href="#/show/${esc(s.id)}">
        <span class="date">${esc(s.date)}</span>
        <span class="venue">${esc(s.venue)}</span>
        <span class="place">${esc(place(s))}</span>
        ${s.songCount ? "" : `<span class="muted">no setlist</span>`}
      </a></li>`,
    )
    .join("")}</ol>`;
}

const routes = {
  async home() {
    const years = await api("years");
    const total = years.reduce((n, y) => n + y.count, 0);
    return `<h2>${total.toLocaleString()} shows, ${years[0].year}–${years.at(-1).year}</h2>
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
      <h2>${esc(year)} <span class="muted">· ${shows.length} shows</span></h2>
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
      <h2>${esc(formatDate(s.date))}</h2>
      <p class="lede">${esc(s.venue)} · ${esc(place(s))}</p>
      <div class="sets">${sets}</div>`;
  },

  async songs() {
    const songs = await api("songs");
    const rows = songs
      .map(
        (s) => `<tr data-name="${esc(s.name.toLowerCase())}">
          <td><a href="#/song/${esc(s.slug)}">${esc(s.name)}</a></td>
          <td class="num">${s.count}</td>
          <td><a href="#/show/${esc(s.first)}">${esc(s.first.slice(0, 10))}</a></td>
          <td><a href="#/show/${esc(s.last)}">${esc(s.last.slice(0, 10))}</a></td>
        </tr>`,
      )
      .join("");
    return `<h2>${songs.length} songs</h2>
      <input id="song-filter" type="search" placeholder="Filter songs" aria-label="Filter songs">
      <table class="songs">
        <thead><tr><th>Song</th><th class="num">Shows</th><th>First</th><th>Last</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  },

  async song(slug) {
    const s = await api(`songs/${encodeURIComponent(slug)}`);
    if (!s) return `<h2>Song not found</h2>`;
    return `<h2>${esc(s.name)}</h2>
      <p class="lede">Played at ${s.count} shows, ${esc(s.shows[0].date)} to ${esc(s.shows.at(-1).date)}.</p>
      ${showList(s.shows)}`;
  },

  async search(_arg, params) {
    const q = params.get("q") ?? "";
    const shows = await api(`shows?q=${encodeURIComponent(q)}`);
    return `<h2>Shows matching “${esc(q)}” <span class="muted">· ${shows.length}</span></h2>${showList(shows)}`;
  },
};

async function render() {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [name, arg] = path.split("/").map(decodeURIComponent);
  const route = routes[name || "home"];
  try {
    view.innerHTML = route ? await route(arg, new URLSearchParams(query)) : `<h2>Page not found</h2>`;
  } catch (err) {
    view.innerHTML = `<h2>Something went wrong</h2><p class="muted">${esc(err.message)}</p>`;
  }
  window.scrollTo(0, 0);
}

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

window.addEventListener("hashchange", render);
render();
