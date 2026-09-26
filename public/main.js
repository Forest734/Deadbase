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

// A table whose headers sort it. Each column: { label, cell(row) -> html,
// sort(row) -> string|number, num? }. `sorted` is the initially sorted column.
function sortableTable(columns, rows, { sorted = 0, cls = "", rowAttrs = () => "" } = {}) {
  const head = columns
    .map((c, i) => `<th class="${c.num ? "num" : ""}" ${i === sorted ? 'aria-sort="ascending"' : ""}>
        <button type="button" data-col="${i}">${esc(c.label)}</button></th>`)
    .join("");
  const body = rows
    .map((r, ri) => `<tr data-i="${ri}" ${rowAttrs(r)}>${columns
      .map((c) => `<td class="${c.num ? "num" : ""}" data-sort="${esc(c.sort(r))}">${c.cell(r)}</td>`)
      .join("")}</tr>`)
    .join("");
  return `<table class="sortable ${cls}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function sortTable(button) {
  const table = button.closest("table");
  const th = button.parentElement;
  const col = Number(button.dataset.col);
  const num = th.classList.contains("num");
  const dir = th.getAttribute("aria-sort") === "ascending" ? -1 : 1;
  for (const other of table.querySelectorAll("th")) other.removeAttribute("aria-sort");
  th.setAttribute("aria-sort", dir === 1 ? "ascending" : "descending");

  const key = (tr) => tr.children[col].dataset.sort;
  const rows = [...table.tBodies[0].rows];
  rows.sort((a, b) => {
    const cmp = num ? Number(key(a)) - Number(key(b)) : key(a).localeCompare(key(b));
    // Ties keep the original (chronological or alphabetical) order.
    return dir * cmp || Number(a.dataset.i) - Number(b.dataset.i);
  });
  table.tBodies[0].append(...rows);
}

function showList(shows) {
  if (!shows.length) return `<p class="muted">No shows found.</p>`;
  const link = (s, html) => `<a href="#/show/${esc(s.id)}">${html}</a>`;
  return sortableTable(
    [
      { label: "Date", cell: (s) => link(s, esc(s.date)), sort: (s) => s.id },
      { label: "Venue", cell: (s) => link(s, esc(s.venue)), sort: (s) => s.venue },
      { label: "Location", cell: (s) => esc(place(s)), sort: (s) => place(s) },
      {
        label: "Songs",
        num: true,
        cell: (s) => (s.songCount ? s.songCount : `<span class="muted">—</span>`),
        sort: (s) => s.songCount,
      },
    ],
    shows,
    { cls: "shows" },
  );
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
    const showLink = (id) => `<a href="#/show/${esc(id)}">${esc(id.slice(0, 10))}</a>`;
    return `<h2>${songs.length} songs</h2>
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

view.addEventListener("click", (e) => {
  const button = e.target.closest("th button[data-col]");
  if (button) sortTable(button);
});

window.addEventListener("hashchange", render);
render();
