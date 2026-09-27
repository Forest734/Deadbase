# Deadbase

Browse Grateful Dead setlists by year, show and song, or explore them on the
Stats page. Express 5 serves a JSON API plus a no-build front end in `public/`.

```sh
npm install
npm run dev      # http://localhost:3000 (PORT overrides), restarts on change
npm test
```

## What's in it

- **Years, Songs and show pages.** Every show by year; each setlist split into
  sets, with segues marked; and every song with the shows it was played at.
  Long show lists have a shows-per-month (or per-year) chart whose columns
  narrow them. Setlist lengths show as bars, and runs of shows at one
  venue are tagged. The song index shows how often, and across which years,
  each song was played.
- **Artwork.** A skull logo beside each page title, traced with potrace from
  the project's drawings.
- **Stats.** Charts for any range of years or era (Pigpen, Keith & Donna,
  Brent, Vince), for the whole band or for one state, country or venue: shows
  per year and month, songs in rotation, segues, openers, encores, where they
  played, and records. Every bar, cell and tile links to the shows behind it.
- **Search** by venue, city, state, country or date, and **Start over** in the
  header to get back to the home page with nothing filtered.

Pages are hash routes (`#/year/1977`, `#/show/1977-05-08`, `#/song/morning-dew`,
`#/stats?state=CA&from=1979`), so any view can be bookmarked or shared.

## Data

`data/shows.json` is generated from
[gdshowsdb](https://github.com/jefmsmit/gdshowsdb) (MIT, © Jeff Smith) and
committed, so the app needs no network access. The importer records the source
commit. To refresh it:

```sh
git clone --depth 1 https://github.com/jefmsmit/gdshowsdb /tmp/gdshowsdb
npm run import -- /tmp/gdshowsdb
```

The source has dates, places and setlists with segues, and nothing else: no
show notes, guests or recording details. It also has no encore marker, so a
final set of three songs or fewer, after at least one other set, is labelled
"Encore" (see `src/data.js`). 282 of the 2,358 shows, almost all from 1965–1970,
have no setlist.

## API

| Route | Returns |
|---|---|
| `GET /health` | `{ status: "ok" }` |
| `GET /api` | service name, version, and the gdshowsdb commit the data came from |
| `GET /api/years?<filters>` | `[{ year, count, months }]` for every year 1965–1995, counting only matching shows; `months` is 12 per-month counts, January first |
| `GET /api/shows?<filters>` | summaries of the matching shows, oldest first |
| `GET /api/shows/:id` | one show with `sets[{ label, songs[{ name, slug, segue }] }]`, plus `prev`/`next` ids |
| `GET /api/songs` | `[{ slug, name, count, first, last }]`, where `first` and `last` are show ids |
| `GET /api/songs/:slug` | a song and every show it was played at |
| `GET /api/stats?<filters>` | totals, song rotation, segues, openers, encores, places, venues and records for the matching shows |

`/api/years`, `/api/shows` and `/api/stats` take the same filters, and they
combine:

- `year`, or `from` and `to`: inclusive date prefixes such as `1977`, `1977-05`
  or `1977-05-08`.
- `song`: a song slug. `segue`: two slugs, `slugA,slugB`, for shows where A
  segues straight into B.
- `venue`, `city`, `state`, `country`: exact matches.
- `q`: matches any part of the date, venue, city, state or country.

The stats leave out Drums, Space and untitled jams, which are parts of a show
rather than songs and would otherwise top every ranking.

Show ids are the date (`1977-05-08`), with a `-N` suffix when the band played
more than one show that day.
