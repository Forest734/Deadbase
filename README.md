# Deadbase

Browse Grateful Dead setlists by year, show, and song. Express 5 serves a JSON
API plus a no-build front end in `public/`.

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
| `GET /api/years` | `[{ year, count }]` |
| `GET /api/shows?year=&song=&q=` | show summaries; filters combine (`song` is a slug, `q` matches date/venue/city/state/country) |
| `GET /api/shows/:id` | one show with `sets[{ label, songs[{ name, slug, segue }] }]`, plus `prev`/`next` ids |
| `GET /api/songs` | `[{ slug, name, count, first, last }]` |
| `GET /api/songs/:slug` | a song and every show it was played at |

Show ids are the date (`1977-05-08`), with a `-N` suffix when the band played
more than one show that day.
