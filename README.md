# Deadbase

Browse Grateful Dead setlists by year, show, and song, or explore them on the
Stats page: charts over any range of years or era, for the whole band or one
state, country or venue, each linking to the shows behind it. Express 5 serves a JSON API plus a no-build front end in `public/`.

```sh
npm install
npm run dev      # http://localhost:3000, restarts on change
npm test
```

## Data

`data/shows.json` is generated from
[gdshowsdb](https://github.com/jefmsmit/gdshowsdb) (MIT, © Jeff Smith) and
committed, so the app needs no network access. The importer records the source
commit. To refresh it:

```sh
git clone --depth 1 https://github.com/jefmsmit/gdshowsdb /tmp/gdshowsdb
npm run import -- /tmp/gdshowsdb
```

The source has no encore marker. A final set of three songs or fewer, after at
least one other set, is labelled "Encore" (see `src/data.js`).

## API

| Route | Returns |
|---|---|
| `GET /api/years?<filters>` | `[{ year, count, months }]` for every year 1965–1995, counting only matching shows; `months` is 12 per-month counts, January first |
| `GET /api/shows?year=&from=&to=&song=&segue=&venue=&city=&state=&country=&q=` | show summaries; filters combine (see below) |
| `GET /api/shows/:id` | one show with `sets[{ label, songs[{ name, slug, segue }] }]`, plus `prev`/`next` ids |
| `GET /api/songs` | `[{ slug, name, count, first, last }]` |
| `GET /api/songs/:slug` | a song and every show it was played at |
| `GET /api/stats?<filters>` | totals, song rotation, segues, openers, encores, places, venues and records for the matching shows |

All three take the same filters. `from` and `to` are inclusive date prefixes: `1977`, `1977-05` or `1977-05-08`.
`song` is a slug and `segue` is two slugs, `slugA,slugB`, for shows where A
segues straight into B. `venue`, `city`, `state` and `country` match exactly,
and `q` matches any part of the date, venue, city, state or country.

The stats leave out Drums, Space and untitled jams, which are parts of a show
rather than songs and would otherwise top every ranking.

Show ids are the date (`1977-05-08`), with a `-N` suffix when the band played
more than one show that day.
