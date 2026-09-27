// Helpers shared by the page modules.

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const place = (s) => [s.city, s.state ?? s.country].filter(Boolean).join(", ");

// "Sun, May 8, 1977", for headings.
export const formatDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });

// "May 8, 1977", for lists and tables. Takes a show id or an ISO date.
export const formatDay = (iso) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });

export async function api(path) {
  const res = await fetch(`api/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

// A table whose headers sort it. Each column: { label, cell(row) -> html,
// sort(row) -> string|number, num?, cls?, note? }, where `note` is extra
// html under the header's label. `sorted` is the initially sorted
// column. The table's data-sorted says how it's sorted now: "0" is column 0
// ascending, "0d" descending.
export function sortableTable(columns, rows, { sorted = 0, cls = "", rowAttrs = () => "" } = {}) {
  const classes = (c) => [c.num && "num", c.cls].filter(Boolean).join(" ");
  const head = columns
    .map((c, i) => `<th class="${classes(c)}" ${i === sorted ? 'aria-sort="ascending"' : ""}>
        <button type="button" data-col="${i}">${esc(c.label)}</button>${c.note ?? ""}</th>`)
    .join("");
  const body = rows
    .map((r, ri) => `<tr data-i="${ri}" ${rowAttrs(r)}>${columns
      .map((c) => `<td class="${classes(c)}" data-sort="${esc(c.sort(r))}">${c.cell(r)}</td>`)
      .join("")}</tr>`)
    .join("");
  return `<table class="sortable ${cls}" data-sorted="${sorted}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function sortTable(button) {
  const table = button.closest("table");
  const th = button.parentElement;
  const col = Number(button.dataset.col);
  const num = th.classList.contains("num");
  const dir = th.getAttribute("aria-sort") === "ascending" ? -1 : 1;
  for (const other of table.querySelectorAll("th")) other.removeAttribute("aria-sort");
  th.setAttribute("aria-sort", dir === 1 ? "ascending" : "descending");
  table.dataset.sorted = dir === 1 ? String(col) : `${col}d`;

  const key = (tr) => tr.children[col].dataset.sort;
  const rows = [...table.tBodies[0].rows];
  rows.sort((a, b) => {
    const cmp = num ? Number(key(a)) - Number(key(b)) : key(a).localeCompare(key(b));
    // Ties keep the original (chronological or alphabetical) order.
    return dir * cmp || Number(a.dataset.i) - Number(b.dataset.i);
  });
  table.tBodies[0].append(...rows);
}

// A page's heading and summary line with the Deadbase skull to their left
// (show, song and stats pages).
export const pageTitle = (heading, lede = "") =>
  `<div class="page-title"><span class="logo" aria-hidden="true"></span><div>${heading}${lede}</div></div>`;

// A thin bar for a value in a table cell, scaled to the column's largest
// value, with the number at its tip.
export const inlineBar = (value, max) =>
  `<span class="inline-bar"><span class="fill" style="--w:${value / max}"></span><span class="val">${value.toLocaleString()}</span></span>`;

// Show summaries (oldest first) as a sortable table, each linking to its show.
// In date order, repeat nights at one venue are greyed after the first, which
// is tagged with the run's length, and a line marks each new month (or year).
// Lists of 8 or more also get a filter box and, unless `overview` is false, a
// shows-per-month (or per-year) chart whose columns narrow the list.
export function showList(shows, { overview = true } = {}) {
  if (!shows.length) return `<p class="muted">No shows found.</p>`;
  const oneYear = shows[0].year === shows.at(-1).year;
  const periodOf = (s) => (oneYear ? s.date.slice(0, 7) : String(s.year));
  const sameVenue = (a, b) => a && b && a.venue === b.venue && a.city === b.city;
  const maxSongs = Math.max(1, ...shows.map((s) => s.songCount));

  const meta = new Map();
  shows.forEach((s, i) => {
    const prev = shows[i - 1];
    let run = 1;
    if (!sameVenue(prev, s)) while (sameVenue(shows[i + run - 1], shows[i + run])) run++;
    meta.set(s, {
      period: periodOf(s),
      repeat: sameVenue(prev, s),
      run: sameVenue(prev, s) ? 0 : run,
      starts: !prev || periodOf(prev) !== periodOf(s),
    });
  });
  const rowAttrs = (s) => {
    const m = meta.get(s);
    const text = [s.date, formatDay(s.date), s.venue, s.city, s.state, s.country].filter(Boolean).join(" ");
    const cls = [m.repeat && "repeat", m.starts && "starts"].filter(Boolean).join(" ");
    return `class="${cls}" data-period="${m.period}" data-text="${esc(text.toLowerCase())}"`;
  };

  const link = (s, html) => `<a href="#/show/${esc(s.id)}">${html}</a>`;
  const runTag = (s) => (meta.get(s).run > 1 ? ` <span class="run-tag">${meta.get(s).run}-show run</span>` : "");
  const table = sortableTable(
    [
      { label: "Date", cell: (s) => link(s, esc(formatDay(s.date))), sort: (s) => s.id },
      {
        label: "Venue",
        // The place repeats under the venue for phones, which hide the Location column.
        cell: (s) => `${link(s, esc(s.venue))}${runTag(s)}<span class="where">${esc(place(s))}</span>`,
        sort: (s) => s.venue,
      },
      { label: "Location", cell: (s) => esc(place(s)), sort: (s) => place(s) },
      {
        label: "Songs",
        num: true,
        cls: "bars",
        cell: (s) => (s.songCount ? inlineBar(s.songCount, maxSongs) : `<span class="muted">—</span>`),
        sort: (s) => s.songCount,
      },
    ],
    shows,
    { cls: "shows", rowAttrs },
  );
  if (shows.length < 8) return table;
  return `<div class="show-list" data-list>
      <div class="list-tools">
        <input type="search" class="list-filter" placeholder="Filter by venue, city or date" aria-label="Filter these shows">
        <p class="list-status" aria-live="polite">${plural(shows.length, "show")}</p>
      </div>
      ${overview ? listOverview(shows, oneYear, periodOf) : ""}
      ${table}
    </div>`;
}

// Shows per month of the year (or per year, for longer lists). Each column is
// a toggle that narrows the list to its period.
function listOverview(shows, oneYear, periodOf) {
  const counts = new Map();
  for (const s of shows) counts.set(periodOf(s), (counts.get(periodOf(s)) ?? 0) + 1);
  const first = shows[0].year;
  const periods = oneYear
    ? MONTHS.map((_, m) => `${first}-${String(m + 1).padStart(2, "0")}`)
    : Array.from({ length: shows.at(-1).year - first + 1 }, (_, i) => String(first + i));
  const label = (p) => (oneYear ? `${MONTHS[p.slice(5) - 1]} ${p.slice(0, 4)}` : p);
  const max = Math.max(...counts.values());
  const peak = periods.find((p) => counts.get(p) === max);
  const every = oneYear || periods.length <= 8 ? 1 : periods.length > 16 ? 5 : 2;

  const cols = periods.map((p) => {
    const n = counts.get(p) ?? 0;
    const tip = plural(n, "show");
    const attrs = n ? `data-tip="${tip}" data-tip-label="${label(p)}"` : "disabled";
    return `<button type="button" class="ov-col" data-period="${p}" style="--h:${(n / max) * 100}%" aria-pressed="false"
        aria-label="${label(p)}: ${tip}" ${attrs}>${p === peak ? `<span class="ov-peak">${n}</span>` : ""}<span class="bar"></span></button>`;
  });
  const ticks = periods.map((p, i) => {
    const show = (oneYear ? i : Number(p)) % every === 0;
    return `<span>${show ? (oneYear ? MONTHS[i] : p) : ""}</span>`;
  });
  return `<div class="overview" style="--n:${periods.length}">
      <div class="ov-cols">${cols.join("")}</div>
      <div class="ov-axis" aria-hidden="true">${ticks.join("")}</div>
      <p class="ov-hint">Click a ${oneYear ? "month" : "year"} to see only its shows; click it again for all.</p>
    </div>`;
}

// Delegated listeners for show lists, attached once to #view: the overview
// columns pick a period, the box matches text, and both apply together.
export function wireShowLists(view) {
  const apply = (list) => {
    const needle = list.querySelector(".list-filter").value.trim().toLowerCase();
    const period = list.dataset.period ?? "";
    const rows = [...list.querySelectorAll("tbody tr")];
    let shown = 0;
    for (const row of rows) {
      row.hidden = Boolean((period && row.dataset.period !== period) || (needle && !row.dataset.text.includes(needle)));
      if (!row.hidden) shown++;
    }
    for (const col of list.querySelectorAll(".ov-col")) {
      col.setAttribute("aria-pressed", String(col.dataset.period === period));
    }
    list.classList.toggle("picking", Boolean(period));
    list.querySelector(".list-status").innerHTML = shown === rows.length
      ? plural(rows.length, "show")
      : `${shown.toLocaleString()} of ${plural(rows.length, "show")} · <button type="button" class="link" data-list-clear>Show all</button>`;
  };
  view.addEventListener("input", (e) => {
    if (e.target.matches(".list-filter")) apply(e.target.closest("[data-list]"));
  });
  view.addEventListener("click", (e) => {
    const list = e.target.closest("[data-list]");
    if (!list) return;
    const col = e.target.closest(".ov-col");
    if (col) {
      list.dataset.period = list.dataset.period === col.dataset.period ? "" : col.dataset.period;
      apply(list);
    } else if (e.target.closest("[data-list-clear]")) {
      list.dataset.period = "";
      list.querySelector(".list-filter").value = "";
      apply(list);
    }
  });
}
