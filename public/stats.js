// The stats page, #/stats?from=&to=. Every chart covers that date range, and
// every mark links to the shows behind it (mostly via #/shows?<filters>).
import { api, esc, formatDate, place, sortableTable } from "./lib.js";

// Line-ups by keyboard player, the usual way fans split up the band's history.
// Pigpen and Keith overlap from late 1971 to mid 1972.
const ERAS = [
  { name: "Pigpen", from: "1965", to: "1972-06-17" },
  { name: "Keith & Donna", from: "1971-10-19", to: "1979-02-17" },
  { name: "Brent", from: "1979-04-22", to: "1990-07-23" },
  { name: "Vince", from: "1990-09-07", to: "1995" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Colour bins 1-5 map to --seq-1..5 (one blue ramp). A value's bin is the
// number of thresholds it reaches.
const bin = (value, thresholds) => thresholds.filter((t) => value >= t).length;
const MONTH_BINS = [1, 3, 6, 10, 15];
const SHARE_BINS = [0, 10, 25, 45, 70]; // percent; only used for songs that were played
const STATE_BINS = [1, 5, 20, 60, 200];

// US states as tiles, roughly where they sit on a map. "." is an empty slot.
const STATE_GRID = [
  "AK . . . . . . . . . ME",
  ". . . . . . . . . VT NH",
  "WA ID MT ND MN IL WI MI NY RI MA",
  "OR NV WY SD IA IN OH PA NJ CT .",
  "CA UT CO NE MO KY WV VA MD DE .",
  ". AZ NM KS AR TN NC SC DC . .",
  ". . . OK LA MS AL GA . . .",
  "HI . . TX . . . . FL . .",
];

const STATES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "Washington, D.C.", FL: "Florida",
  GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const num = (n) => n.toLocaleString();
const plural = (n, word) => `${num(n)} ${word}${n === 1 ? "" : "s"}`;
const query = (filters) => new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
const statsHref = (from, to) => `#/stats?${query({ from, to })}`;
const showsHref = (filters) => `#/shows?${query(filters)}`;

// Does a period ("1977" or "1977-05") overlap the from/to range? Same prefix
// rules as the API's date filter.
const overlaps = (key, from, to) => (!from || `${key}￿` >= from) && (!to || key <= `${to}￿`);

// Narrow a period to the range, so a link from a partly covered year lists
// only the shows that the chart counted.
const clamp = (key, from, to) => ({
  from: from.startsWith(key) ? from : key,
  to: to.startsWith(key) ? to : key,
});

// "1977", "May 1977" or "May 8, 1977", for a date prefix.
function formatPrefix(prefix) {
  const [y, m, d] = prefix.split("-");
  if (d) return new Date(`${prefix}T12:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return m ? `${MONTHS[m - 1]} ${y}` : y;
}

function formatRange(from, to) {
  if (!from && !to) return "All years";
  if (!to) return `Since ${formatPrefix(from)}`;
  if (!from) return `Through ${formatPrefix(to)}`;
  if (from === to) return formatPrefix(from);
  return `${formatPrefix(from)}${from.length === 4 && to.length === 4 ? "–" : " – "}${formatPrefix(to)}`;
}

function timeBetween(a, b) {
  const days = (new Date(b.slice(0, 10)) - new Date(a.slice(0, 10))) / 864e5;
  if (days >= 365) return plural(Math.round(days / 365.25), "year");
  return days >= 60 ? plural(Math.round(days / 30.44), "month") : plural(Math.round(days), "day");
}

let songNames = null;
async function songName(slug) {
  songNames ??= api("songs")
    .then((songs) => new Map(songs.map((s) => [s.slug, s.name])))
    .catch((err) => {
      songNames = null;
      throw err;
    });
  return (await songNames).get(slug) ?? slug;
}

// A heading for a #/shows?... drill-down, e.g. "Morning Dew · 1977".
export async function describeFilters(params) {
  const get = (key) => params.get(key) ?? "";
  const parts = [];
  if (get("segue")) {
    const [a, b] = get("segue").split(",");
    parts.push(`${await songName(a)} > ${await songName(b)}`);
  }
  if (get("song")) parts.push(await songName(get("song")));
  if (get("venue")) parts.push(get("city") ? `${get("venue")}, ${get("city")}` : get("venue"));
  else if (get("city")) parts.push(get("city"));
  if (get("state")) parts.push(STATES[get("state")] ?? get("state"));
  else if (get("country")) parts.push(get("country"));
  if (get("year")) parts.push(get("year"));
  if (get("from") || get("to")) parts.push(formatRange(get("from"), get("to")));
  if (get("q")) parts.push(`“${get("q")}”`);
  return parts.join(" · ") || "All shows";
}

export async function statsPage(params) {
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const range = query({ from, to });
  const oneYear = Boolean(from) && from.slice(0, 4) === to.slice(0, 4);
  const [years, stats, days] = await Promise.all([
    api("years"),
    api(`stats?${range}`),
    oneYear ? api(`shows?${range}`) : [],
  ]);
  const era = ERAS.find((e) => e.from === from && e.to === to);
  const { totals } = stats;
  const heading = `<h2>Stats <span class="muted">· ${esc(era ? `${era.name} era` : formatRange(from, to))}</span></h2>`;
  if (!totals.shows) return `${heading}${scopeBar(years, from, to)}<p class="muted">No shows in this range.</p>`;

  const coverage = totals.setlists === totals.shows
    ? `setlists for all ${num(totals.shows)} shows`
    : `setlists for ${num(totals.setlists)} of ${num(totals.shows)} shows`;
  const songLink = (r) => `#/song/${r.slug}`;
  const songLabel = (r) => esc(r.name);
  return `${heading}
    <p class="lede">${esc(formatPrefix(stats.first))} to ${esc(formatPrefix(stats.last))} · ${coverage}</p>
    ${scopeBar(years, from, to)}
    ${yearPager(years, from, to)}
    ${kpis(totals)}
    ${careerFigure(years, from, to)}
    ${oneYear ? dayCalendar(days, Number(from.slice(0, 4))) : ""}
    ${rotationFigure(stats.rotation, from, to)}
    ${rankedList("Segues", stats.segues, {
      cls: "wide",
      note: "Songs played back to back, without a break. Click a pair for the shows.",
      label: (r) => `${esc(r.from.name)} &gt; ${esc(r.to.name)}`,
      href: (r) => showsHref({ segue: `${r.from.slug},${r.to.slug}`, from, to }),
    })}
    <div class="panels">
      ${rankedList("Show openers", stats.openers, { label: songLabel, href: songLink })}
      ${rankedList("Second-set openers", stats.setTwoOpeners, { label: songLabel, href: songLink })}
      ${rankedList("Encores", stats.encores, { label: songLabel, href: songLink })}
    </div>
    <div class="places">
      ${stateMap(stats, from, to)}
      ${rankedList("Venues", stats.venues, {
        label: (r) => esc(r.venue),
        sub: (r) => esc(place(r)),
        href: (r) => showsHref({ venue: r.venue, city: r.city, from, to }),
      })}
    </div>
    ${recordCards(stats.records)}
    <p class="muted note">Drums, Space and untitled jams are left out of the song counts and rankings.</p>`;
}

function scopeBar(years, from, to) {
  const chip = (label, f, t) => {
    const current = f === from && t === to ? ' aria-current="page"' : "";
    const title = f ? ` title="${esc(formatRange(f, t))}"` : "";
    return `<a class="chip" href="${esc(statsHref(f, t))}"${current}${title}>${esc(label)}</a>`;
  };
  const options = (selected) =>
    years.map((y) => `<option${y.year === selected ? " selected" : ""}>${y.year}</option>`).join("");
  return `<div class="scope">
      <div class="chips" role="group" aria-label="Eras">
        ${chip("All years", "", "")}${ERAS.map((e) => chip(e.name, e.from, e.to)).join("")}
      </div>
      <div class="range">
        <label>From <select data-scope>${options(Number(from.slice(0, 4)) || years[0].year)}</select></label>
        <label>to <select data-scope>${options(Number(to.slice(0, 4)) || years.at(-1).year)}</select></label>
        <button type="button" class="chip" data-random="${esc(query({ from, to }))}">Random show</button>
      </div>
    </div>`;
}

function yearPager(years, from, to) {
  if (from !== to || from.length !== 4) return "";
  const y = Number(from);
  const step = (n, text) =>
    years.some((x) => x.year === n) ? `<a href="${esc(statsHref(n, n))}">${text}</a>` : "<span></span>";
  return `<p class="pager">${step(y - 1, `← ${y - 1}`)}<a href="#/year/${y}">All ${y} shows</a>${step(y + 1, `${y + 1} →`)}</p>`;
}

function kpis(t) {
  const tile = (label, value) =>
    `<div class="kpi"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span></div>`;
  return `<div class="kpis">
      ${tile("Shows", num(t.shows))}${tile("Venues", num(t.venues))}${tile("Different songs", num(t.songs))}
      ${tile("Debuts", num(t.debuts))}${tile("Songs per show", t.songsPerShow.toLocaleString())}
    </div>`;
}

function legend(title, labels, bins = [1, 2, 3, 4, 5]) {
  const keys = labels.map((l, i) => `<span class="key"><span class="swatch b${bins[i]}"></span>${esc(l)}</span>`);
  return `<div class="legend"><span>${esc(title)}</span>${keys.join("")}</div>`;
}

const tableView = (table) =>
  `<details class="table-view"><summary>Show as a table</summary><div class="scroll">${table}</div></details>`;

// Shows per year across the whole career, with the range highlighted, over a
// year-by-month heatmap on the same columns.
function careerFigure(years, from, to) {
  const max = Math.max(...years.map((y) => y.count));
  const step = [10, 20, 25, 50, 100, 200, 500].find((s) => max / s <= 4);
  const top = Math.ceil(max / step) * step;
  const pct = (n) => `${(n / top) * 100}%`;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const peak = years.reduce((a, b) => (b.count > a.count ? b : a));

  const cols = years.map((y) => {
    const cls = overlaps(String(y.year), from, to) ? "col in" : "col";
    return `<a class="${cls}" href="${esc(statsHref(y.year, y.year))}" draggable="false" style="--h:${pct(y.count)}"
        data-year="${y.year}" data-count="${y.count}" data-tip="${plural(y.count, "show")}" data-tip-label="${y.year}"
        aria-label="${y.year}: ${plural(y.count, "show")}">${y === peak ? `<span class="peak">${y.count}</span>` : ""}<span class="bar"></span></a>`;
  });

  const cells = years.flatMap((y) =>
    y.months.map((n, m) => {
      const key = `${y.year}-${String(m + 1).padStart(2, "0")}`;
      const out = overlaps(key, from, to) ? "" : " out";
      if (!n) return `<span class="cell${out}"></span>`;
      const when = `${MONTHS[m]} ${y.year}`;
      return `<a class="cell b${bin(n, MONTH_BINS)}${out}" href="${esc(showsHref({ from: key, to: key }))}"
        data-tip="${plural(n, "show")}" data-tip-label="${when}" aria-label="${when}: ${plural(n, "show")}"></a>`;
    }),
  );

  const table = sortableTable(
    [
      { label: "Year", cell: (y) => `<a href="${esc(statsHref(y.year, y.year))}">${y.year}</a>`, sort: (y) => y.year },
      { label: "Shows", num: true, cell: (y) => y.count, sort: (y) => y.count },
      ...MONTHS.map((m, i) => ({ label: m, num: true, cell: (y) => y.months[i] || "", sort: (y) => y.months[i] })),
    ],
    years,
    { cls: "compact" },
  );

  return `<figure class="card">
      <figcaption>
        <h3>Shows per year</h3>
        <p>Click a year, or drag across several, to set the range. Months below link to their shows.</p>
      </figcaption>
      <div class="career" style="--n:${years.length}">
        <div class="y-axis" aria-hidden="true">${ticks.map((t) => `<span style="bottom:${pct(t)}">${t}</span>`).join("")}</div>
        <div class="cols">${ticks.map((t) => `<span class="gridline" style="bottom:${pct(t)}"></span>`).join("")}${cols.join("")}</div>
        <span></span>
        <div class="x-axis" aria-hidden="true">${years.map((y) => `<span>${y.year % 5 ? "" : y.year}</span>`).join("")}</div>
        <div class="m-axis" aria-hidden="true">${MONTHS.map((m, i) => `<span>${i % 3 ? "" : m}</span>`).join("")}</div>
        <div class="months">${cells.join("")}</div>
      </div>
      ${legend("Shows in a month", ["1–2", "3–5", "6–9", "10–14", "15+"])}
      ${tableView(table)}
    </figure>`;
}

// One year as a GitHub-style grid: a column per week, a row per weekday.
function dayCalendar(shows, year) {
  const byDate = new Map();
  for (const s of shows) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const start = new Date(Date.UTC(year, 0, 1));
  const offset = start.getUTCDay();
  const parts = ["", "Mon", "", "Wed", "", "Fri", ""].map((w, r) => `<span class="cal-label" style="grid-area:${r + 2}/1">${w}</span>`);
  for (const d = new Date(start); d.getUTCFullYear() === year; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const i = Math.round((d - start) / 864e5) + offset;
    const week = Math.floor(i / 7) + 2;
    if (d.getUTCDate() === 1) parts.push(`<span class="cal-label" style="grid-area:1/${week}">${MONTHS[d.getUTCMonth()]}</span>`);
    const at = `grid-area:${(i % 7) + 2}/${week}`;
    const day = byDate.get(iso);
    if (!day) {
      parts.push(`<span class="day" style="${at}"></span>`);
      continue;
    }
    const href = day.length === 1 ? `#/show/${day[0].id}` : showsHref({ from: iso, to: iso });
    const what = day.length === 1 ? day[0].venue : `${day.length} shows`;
    parts.push(`<a class="day b${day.length === 1 ? 3 : 5}" style="${at}" href="${esc(href)}"
      data-tip="${esc(what)}" data-tip-label="${esc(`${formatDate(iso)} · ${place(day[0])}`)}"
      aria-label="${esc(`${formatDate(iso)}: ${what}`)}"></a>`);
  }
  return `<figure class="card">
      <figcaption><h3>${year}, day by day</h3><p>${plural(shows.length, "show")}. Click a day to open it.</p></figcaption>
      <div class="scroll"><div class="calendar">${parts.join("")}</div></div>
      ${legend("Shows that day", ["1", "2"], [3, 5])}
    </figure>`;
}

// The most played songs against time: each cell is the share of that
// year's (or month's) shows that featured the song.
function rotationFigure({ buckets, songs }, from, to) {
  if (buckets.length < 2 || !songs.length) return "";
  const monthly = buckets[0].key.length === 7;
  const name = (key) => (monthly ? `${MONTHS[key.slice(5) - 1]} ${key.slice(0, 4)}` : key);
  const every = buckets.length > 16 ? 5 : buckets.length > 8 ? 2 : 1;
  const head = buckets.map((b, i) => {
    const show = (monthly ? i : Number(b.key)) % every === 0;
    return `<span class="rot-label">${show ? (monthly ? MONTHS[b.key.slice(5) - 1] : b.key) : ""}</span>`;
  });

  const rows = songs.map((s) => {
    const cells = s.cells.map((n, i) => {
      const b = buckets[i];
      if (!b.shows) return `<span class="cell na"></span>`;
      if (!n) return `<span class="cell"></span>`;
      const tip = `${n} of ${plural(b.shows, "show")}`;
      return `<a class="cell b${bin((n / b.shows) * 100, SHARE_BINS)}" href="${esc(showsHref({ song: s.slug, ...clamp(b.key, from, to) }))}"
        data-tip="${tip}" data-tip-label="${esc(`${s.name} · ${name(b.key)}`)}" aria-label="${esc(`${s.name}, ${name(b.key)}: ${tip}`)}"></a>`;
    });
    return `<a class="rot-name" href="#/song/${esc(s.slug)}" title="${esc(s.name)}">${esc(s.name)}</a>
      <span class="rot-count">${s.shows}</span>${cells.join("")}`;
  });

  const table = sortableTable(
    [
      { label: "Song", cell: (s) => `<a href="#/song/${esc(s.slug)}">${esc(s.name)}</a>`, sort: (s) => s.name },
      { label: "Shows", num: true, cell: (s) => s.shows, sort: (s) => s.shows },
      ...buckets.map((b, i) => ({ label: name(b.key), num: true, cell: (s) => s.cells[i] || "", sort: (s) => s.cells[i] })),
    ],
    songs,
    { sorted: -1, cls: "compact" },
  );

  const unit = monthly ? "month" : "year";
  return `<figure class="card">
      <figcaption>
        <h3>Songs in rotation</h3>
        <p>The ${songs.length} most played songs, shaded by how many of each ${unit}’s shows they were played at. Click a cell for those shows.</p>
      </figcaption>
      <div class="scroll"><div class="rot" style="--n:${buckets.length}">
        <span></span><span class="rot-count">Shows</span>${head.join("")}${rows.join("")}
      </div></div>
      ${legend(`Share of the ${unit}’s shows`, ["under 10%", "10–24%", "25–44%", "45–69%", "70% or more"])}
      ${tableView(table)}
    </figure>`;
}

function rankedList(title, rows, { label, href, sub = () => "", note = "", cls = "" }) {
  if (!rows.length) return "";
  const max = rows[0].shows;
  const items = rows.map((r) => `<li><a href="${esc(href(r))}">
      <span class="name">${label(r)}</span>${sub(r) ? `<span class="sub">${sub(r)}</span>` : ""}
      <span class="meter"><span class="fill" style="--w:${r.shows / max}"></span><span class="val">${num(r.shows)}</span></span>
    </a></li>`);
  return `<section class="card ranked ${cls}">
      <h3>${esc(title)}</h3>${note ? `<p>${esc(note)}</p>` : ""}
      <ol>${items.join("")}</ol>
    </section>`;
}

function stateMap({ states, countries }, from, to) {
  const counts = new Map(states.map((s) => [s.state, s.shows]));
  const tiles = STATE_GRID.flatMap((row, r) =>
    row.split(" ").map((code, c) => {
      if (code === ".") return "";
      const n = counts.get(code) ?? 0;
      const at = `grid-area:${r + 1}/${c + 1}`;
      if (!n) return `<span class="tile" style="${at}" data-tip="No shows" data-tip-label="${STATES[code]}">${code}</span>`;
      return `<a class="tile b${bin(n, STATE_BINS)}" style="${at}" href="${esc(showsHref({ country: "US", state: code, from, to }))}"
        data-tip="${plural(n, "show")}" data-tip-label="${STATES[code]}" aria-label="${STATES[code]}: ${plural(n, "show")}">${code}</a>`;
    }),
  );
  const abroad = countries.length
    ? `<p class="abroad">Outside the US: ${countries
        .map((c) => `<a href="${esc(showsHref({ country: c.country, from, to }))}">${esc(c.country)}</a> ${c.shows}`)
        .join(" · ")}</p>`
    : "";
  const table = sortableTable(
    [
      { label: "State", cell: (s) => esc(STATES[s.state] ?? s.state), sort: (s) => STATES[s.state] ?? s.state },
      { label: "Shows", num: true, cell: (s) => s.shows, sort: (s) => s.shows },
    ],
    [...states].sort((a, b) => b.shows - a.shows),
    { sorted: -1, cls: "compact" },
  );
  return `<figure class="card">
      <figcaption><h3>Where they played</h3><p>Click a state for its shows.</p></figcaption>
      <div class="tiles">${tiles.join("")}</div>
      ${legend("Shows", ["1–4", "5–19", "20–59", "60–199", "200+"])}
      ${abroad}
      ${tableView(table)}
    </figure>`;
}

function recordCards({ longestSetlist: set, longestSegue: seg, bustout, venueRun: run }) {
  const card = (href, label, value, detail) => `<a class="card record" href="${esc(href)}">
      <span class="kpi-label">${label}</span><span class="kpi-value">${value}</span><span class="detail">${detail}</span></a>`;
  const ends = (songs) => songs.map((s) => esc(s.name)).filter((_, i) => i === 0 || i === songs.length - 1);
  const cards = [
    set && card(`#/show/${set.id}`, "Longest setlist", plural(set.songCount, "song"),
      `${esc(formatPrefix(set.date))} · ${esc(set.venue)}, ${esc(place(set))}`),
    seg && card(`#/show/${seg.id}`, "Longest segue run", plural(seg.songs.length, "song"),
      `${ends(seg.songs).join(seg.songs.length > 2 ? " &gt; … &gt; " : " &gt; ")} · ${esc(formatPrefix(seg.date))}`),
    bustout && card(`#/show/${bustout.show.id}`, "Biggest bust-out", `${num(bustout.gap)} shows`,
      `${esc(bustout.name)}, back on ${esc(formatPrefix(bustout.show.date))} after ${timeBetween(bustout.prev, bustout.show.date)}`),
    run && card(showsHref({ venue: run.venue, city: run.city, from: run.first, to: run.last }), "Longest run at one venue",
      plural(run.shows, "show"), `${esc(run.venue)} · ${esc(formatRange(run.first, run.last))}`),
  ].filter(Boolean);
  return cards.length ? `<h3 class="section">Records</h3><div class="records">${cards.join("")}</div>` : "";
}

// Delegated listeners for the stats page, attached once to #view: the
// tooltip, drag-to-select on the year chart, the range selects, and the
// random-show button.
export function wireStats(view) {
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  tip.append(document.createElement("strong"), document.createElement("span"));
  document.body.append(tip);

  function showTip(value, label, x, y) {
    tip.firstChild.textContent = value;
    tip.lastChild.textContent = label;
    tip.hidden = false;
    const { width, height } = tip.getBoundingClientRect();
    const left = Math.min(Math.max(8, x - width / 2), innerWidth - width - 8);
    const top = y - height - 12 >= 8 ? y - height - 12 : y + 20;
    tip.style.transform = `translate(${left}px, ${top}px)`;
  }
  const hideTip = () => (tip.hidden = true);
  const tipFor = (el, x, y) => showTip(el.dataset.tip, el.dataset.tipLabel ?? "", x, y);

  // Dragging across the year columns picks a range; the tooltip shows its total.
  let brush = null;
  let brushedAt = -Infinity;
  const columns = () => [...brush.cols.querySelectorAll(".col")];
  const span = () => [Math.min(brush.start, brush.end), Math.max(brush.start, brush.end)];

  function paintBrush(e) {
    const [lo, hi] = span();
    let shows = 0;
    for (const col of columns()) {
      const on = Number(col.dataset.year) >= lo && Number(col.dataset.year) <= hi;
      col.classList.toggle("pick", on);
      if (on) shows += Number(col.dataset.count);
    }
    showTip(plural(shows, "show"), lo === hi ? String(lo) : `${lo}–${hi}`, e.clientX, e.clientY);
  }

  function endBrush() {
    brush.cols.classList.remove("brushing");
    for (const col of columns()) col.classList.remove("pick");
    brush = null;
    hideTip();
  }

  view.addEventListener("pointerdown", (e) => {
    const col = e.target.closest(".cols .col");
    if (!col || e.button !== 0) return;
    const year = Number(col.dataset.year);
    brush = { cols: col.parentElement, start: year, end: year };
    brush.cols.setPointerCapture(e.pointerId);
    brush.cols.classList.add("brushing");
    paintBrush(e);
  });

  view.addEventListener("pointermove", (e) => {
    if (brush) {
      const cols = columns();
      const col = cols.find((c) => e.clientX < c.getBoundingClientRect().right) ?? cols.at(-1);
      brush.end = Number(col.dataset.year);
      return paintBrush(e);
    }
    const el = e.target.closest("[data-tip]");
    if (el) tipFor(el, e.clientX, e.clientY);
    else hideTip();
  });

  view.addEventListener("pointerup", (e) => {
    if (!brush) return;
    const [lo, hi] = span();
    endBrush();
    brushedAt = e.timeStamp;
    location.hash = statsHref(lo, hi);
  });
  view.addEventListener("pointercancel", () => brush && endBrush());
  view.addEventListener("pointerleave", () => brush || hideTip());

  view.addEventListener("focusin", (e) => {
    const el = e.target.closest("[data-tip]");
    if (!el) return hideTip();
    const r = el.getBoundingClientRect();
    tipFor(el, r.left + r.width / 2, r.top);
  });
  view.addEventListener("focusout", hideTip);
  addEventListener("hashchange", hideTip);

  view.addEventListener("click", async (e) => {
    // pointerup already navigated; keep the column's own link from firing too.
    // (A keyboard-activated click has detail 0 and always goes through.)
    if (e.detail && e.target.closest(".cols") && e.timeStamp - brushedAt < 1000) return e.preventDefault();
    const random = e.target.closest("button[data-random]");
    if (!random) return;
    const shows = await api(`shows?${random.dataset.random}`);
    if (shows.length) location.hash = `#/show/${shows[Math.floor(Math.random() * shows.length)].id}`;
  });

  view.addEventListener("change", (e) => {
    if (!e.target.matches("select[data-scope]")) return;
    const selects = [...e.target.closest(".scope").querySelectorAll("select[data-scope]")];
    const [lo, hi] = selects.map((s) => Number(s.value)).sort((a, b) => a - b);
    const all = lo === Number(selects[0].options[0].value) && hi === Number(selects[0].options[selects[0].options.length - 1].value);
    location.hash = all ? statsHref("", "") : statsHref(lo, hi);
  });
}
