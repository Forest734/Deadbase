// Helpers shared by the page modules.

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const place = (s) => [s.city, s.state ?? s.country].filter(Boolean).join(", ");

export const formatDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
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
