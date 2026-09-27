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

// A table whose headers sort it. Each column: { label, cell(row) -> html,
// sort(row) -> string|number, num? }. `sorted` is the initially sorted column.
export function sortableTable(columns, rows, { sorted = 0, cls = "", rowAttrs = () => "" } = {}) {
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

export function sortTable(button) {
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

// A page's heading and summary line with the Deadbase skull to their left
// (show, song and stats pages).
export const pageTitle = (heading, lede = "") =>
  `<div class="page-title"><span class="logo" aria-hidden="true"></span><div>${heading}${lede}</div></div>`;

// Sortable table of show summaries, linking each to its show page.
export function showList(shows) {
  if (!shows.length) return `<p class="muted">No shows found.</p>`;
  const link = (s, html) => `<a href="#/show/${esc(s.id)}">${html}</a>`;
  return sortableTable(
    [
      { label: "Date", cell: (s) => link(s, esc(formatDay(s.date))), sort: (s) => s.id },
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
