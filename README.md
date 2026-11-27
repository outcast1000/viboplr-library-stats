# Viboplr — Library Statistics

A dashboard of your library composition, listening patterns, and top charts — built from your local library and play history.

Externalized from [Viboplr](https://viboplr.com)'s built-in plugins — same code, now shipped as a standalone gallery plugin (id `library-stats`).

## Tabs
- **Library** — tracks, artists, albums, length and size; by format, decade, tag and rating.
- **Listening** — plays by hour and weekday, the listening clock, plays per month.
- **Top** — most played tracks, artists and albums, all time / 30 days / 12 months / by year.
- **Map** (Viboplr 1.0.125+) — every artist with genre tags placed near similar ones, in named neighbourhoods. Built from your tags and the Last.fm similar artists Vibo has already cached; nothing is fetched. The layout code is pure and tested (`buildArtistMap`, `test/artistMap.test.js`).

## Layout
- `manifest.json` — plugin metadata and contributions.
- `index.js` — the plugin code (ES5, executed via `new Function("api", code)`).
- `scripts/` — `bump.sh` (version + changelog) and `package.sh` (build `library-stats.zip` + `update.json`).

## Releasing
See [RELEASING.md](./RELEASING.md): `scripts/bump.sh <patch|minor|major>`, fill the changelog, commit, then push a `vX.Y.Z` tag — CI builds `library-stats.zip` + `update.json` and publishes the release.
