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
    longest run at one venue.

  Every bar, cell and tile links to the shows behind it, and each chart can be
  shown as a table.
- Stats for one state, country or venue. Click a state on the map, a country
  under it, or a venue in the list: the page shows the same charts for just
  that place, followed by the list of its shows. The era buttons, year menus
  and year chart keep the place, so you can see, say, California in the
  Brent era.
- A skull logo (traced from the project artwork), in the app's blue, to the
  left of the title on the Years, year, Songs, show, song and Stats pages.
  Years, year and Songs pages get a one-line summary under the title to match.
- A Start over button in the header, on every page: it goes back to the home
  page and clears the search box, leaving nothing filtered.
- The `/api/stats` endpoint, and new `/api/shows` filters: `from`/`to` date
  range, `segue`, `venue`, `city`, `state` and `country`. `/api/years` now
  includes counts for each month. `/api/years` and `/api/stats` take the same
  filters as `/api/shows`.

### Changed

- Show lists (year, song, search and place pages, and the lists the Stats
  charts open) are easier to scan. Each list of 8 or more shows has a filter box
  and a chart of shows per month (or per year) whose columns narrow the list.
  Each show's setlist length is a small bar. In date order, runs of shows at
  one venue are tagged ("6-show run") with the repeat nights greyed, and a line
  marks each new month or year. On phones the city sits under the venue name.
- The song index shows plays as a bar and a "years played" bar on a timeline
  shared by every song, sortable by how long the song stayed in rotation.
- Show lists, the song index and song pages write dates out ("May 8, 1977")
  instead of showing them as numbers ("1977-05-08").

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
