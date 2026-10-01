# PLAYERLAB

A player-rating lab for EA SPORTS FC 26. It takes 17,347 real player profiles,
learns what actually drives an overall rating, and then shows you the arithmetic —
every prediction splits into exact per-attribute contributions, and because the
model is linear, the What-If Lab is addition rather than simulation.

```bash
npm install
npm run dev          # http://localhost:3000
```

## What it does

| Route | |
| --- | --- |
| `/` | Cinematic landing, R3F dataset hero, live model metrics |
| `/players` | 17,347 searchable profiles — filter by position, league, club, nation, value |
| `/players/[id]` | Attribute table with in-position percentiles, model attribution, peers, scatter |
| `/compare` | A-vs-B across group ratings, all 33 attributes, attribute DNA, model verdict |
| `/whatif` | Drag attributes, watch the predicted rating move, see which attributes caused it |
| `/models` | Cross-validated metrics, coefficients, residual analysis, what was tried and rejected |
| `/api/face/[id]` | Portrait proxy (see Data below) |

## The model

Two independent ridge regressions, because the overall formula is not
position-independent:

| Segment | n | CV R² | CV MAE | Within 1pt |
| --- | --- | --- | --- | --- |
| outfield | 15,512 | 0.9141 | 1.385 | 45.7% |
| goalkeepers | 1,835 | 0.9977 | 0.275 | 99.7% |

All figures are 5-fold out-of-fold. Alpha is chosen per segment by sweep.

**The honest ceiling.** EA's position eligibility flags and attribute × position
interactions were both tested and neither moved outfield R² (`/models` shows the
table). The attributes are in the file; the position weighting that turns them
into a published overall is not. Goalkeepers — whose formula is not
position-dependent — reconstruct to ±0.28, which is the control confirming the
outfield gap is an information limit rather than a weak model. This project does
not claim to have reverse-engineered EA's formula, and the UI never implies it.

Two properties the interface depends on:

- **Linear in the attributes**, so contributions sum exactly to
  `value − baseline`. The attribution charts and What-If Lab are arithmetic.
- **Coefficients can be negative** (10 of 33 outfield, 16 of 33 goalkeeping).
  That is collinearity, not EA penalising an attribute — pace and passing move
  together, so ridge splits a shared signal.

## Data

Source: a real FC 26 export (`FC26_20250921.csv`, 18,405 rows), filtered to
`overall >= 55` → 17,347.

```bash
npm run data:generate   # CSV  -> data/manifest.json + public/data/players.json
npm run data:model      # JSON -> data/model.json
```

`manifest.json` and `model.json` are statically imported. The 3.5 MB player
payload is **columnar** (one flat array per field) and fetched once at runtime
with streamed progress, then hydrated and cached. See `data/schema.md` for the
format and its traps.

Both generated artefacts are committed, so a fresh clone runs without the CSV.
To rebuild them from source, point the converter at your export:

```bash
npm run data:generate -- /path/to/FC26_20250921.csv
npm run data:model
```

`data:generate` takes the CSV path as its first argument and an optional minimum
overall as its second (`npm run data:generate -- ./FC26.csv 60`). With no
argument it falls back to `%USERPROFILE%\Downloads\archive\FC26_20250921.csv`.

**Names are repaired at conversion time.** The upstream export glues the Latin
name onto the player's name in their own script with no separator
(`Mohamed Salah Hamed Ghalyمحمد صلاح`) on 1,341 of 18,405 rows, and a few rows
carry a registry forename nobody uses. `cleanName()` in `scripts/convert-fc26.mjs`
strips the non-Latin run and trims separator artefacts; a small id-keyed
`NAME_OVERRIDES` map corrects the handful that need judgement.

**Group ratings are EA's own.** We tried to reconstruct PAC/SHO/PAS/DRI/DEF/PHY as
a weighted average of member attributes; pace and defending reproduce, shooting
does not. The app therefore reads the published values verbatim and never
derives them.

**Goalkeepers have no group ratings.** All 1,835 GK rows carry `0` across all six
in the source — not a missing value. `Player.hasGroupRatings` gates every
group-rating surface, and GK routes fall back to the five goalkeeping
attributes with an explanation rather than rendering a column of zeros.

Portraits are proxied through `/api/face/[id]`, not hotlinked. The Sofifa CDN
answers `403` to any request without a `Referer: https://sofifa.com/` header,
which a browser `<img>` tag can never send — so a direct `<img src={cdnUrl}>`
silently falls back to the procedural silhouette for every player. The route
rebuilds the upstream path from the numeric id (so it cannot be used as an open
proxy), retries on the CDN's burst throttling (a throttled request comes back
`404` even when the asset exists, so a 404 is retried with backoff rather than
treated as final), and passes the negotiated `Content-Type` through: a 120 px
portrait costs ~4 KB as webp, 240 px ~10 KB. Large hero portraits ask for 240
and fall back to 120, then to the procedural silhouette. A small minority of
players have no portrait published at any size and always take the silhouette.
`NEXT_PUBLIC_USE_FACES=false` disables portraits outright.

The export's `real_face` column is *not* a usable signal here: it marks whether a
face was scanned rather than whether an image exists, and 92% of `real_face=No`
players still have a portrait on the CDN.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Framer Motion ·
React Three Fiber · hand-built SVG charts.

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

Note: on PowerShell use `npm.cmd` if `npm.ps1` is blocked by execution policy.

## Attribution

Player data from a third-party FC 26 export; ratings and group values are
EA SPORTS' published figures. Portraits are served from a Sofifa CDN. Not
affiliated with or endorsed by EA SPORTS.