# Changelog

Notable changes to Deadbase. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- A Stats page with charts for any range of years or era (Pigpen, Keith & Donna,
  Brent, Vince). Pick the range from the era buttons, the year menus, or by
  dragging across the shows-per-year chart:
  - show, venue, song and debut counts;
  - shows per year above a year-by-month heatmap, and a day-by-day calendar
    when the range is a single year;
  - a "songs in rotation" heatmap of the 20 most played songs over time;
  - the most common segues, show openers, second-set openers and encores;
  - a US state map, shows abroad, and the top venues;
  - records: longest setlist, longest segue run, biggest bust-out, and
    longest run at one venue;
  - a button that opens a random show from the range.

  Every bar, cell and tile links to the shows behind it, and each chart can be
  shown as a table.
- The `/api/stats` endpoint, and new `/api/shows` filters: `from`/`to` date
  range, `segue`, `venue`, `city`, `state` and `country`. `/api/years` now
  includes counts for each month.

## [0.1.0] - 2026-09-26

### Added

- Browse all 2,358 shows (1965–1995) by year, with links to the previous and next year.
- Show pages with the setlist split into sets and an encore, segue markers, and
  links to the previous and next show.
- A song index with a filter box, and song pages listing every show where each song was played.
- Search shows by venue, city, state, country, or date.
- Sortable show lists and song index: click a column header to sort, click again to reverse.
- A JSON API: `/api/years`, `/api/shows`, `/api/shows/:id`, `/api/songs`, `/api/songs/:slug`.
- Setlist data imported from [gdshowsdb](https://github.com/jefmsmit/gdshowsdb) (MIT).
