# Letterboxd Compare

Enter two public Letterboxd usernames and compare their taste: films both
have watched (with a ratings face-off and scatter plot), and films both have
on their watchlist.

**Live:** [compare.odtriki.com](https://compare.odtriki.com) (aliases:
[crossover.odtriki.com](https://crossover.odtriki.com),
[scatterboxd-duo.odtriki.com](https://scatterboxd-duo.odtriki.com))

Merge of two former sibling apps — `letterboxd-crossover` (watched/watchlist
overlap) and `letterboxd-scatter-duo` (ratings scatter plot). The "watched by
both" list already carries each user's own rating per film, so the scatter
plot is just a third view over that same data — no separate diary scrape
needed.

## Stack

Next.js, Playwright with `@sparticuz/chromium` (stealth headless Chromium,
needed to get past Letterboxd's anti-scraping measures), `cheerio` for
parsing, and the TMDB API for poster art, genres, and crowd ratings.

## How it works

- [`lib/letterboxd.ts`](lib/letterboxd.ts) scrapes both profiles' `films`
  (watched) and `watchlist` grids, paginated, each with their own star
  rating where present.
- [`app/api/compare/route.ts`](app/api/compare/route.ts) fetches both
  profiles in parallel, intersects them by film, and returns three things:
  the watched-by-both list (with each side's rating), the watchlist-by-both
  list, and per-user counts/status.
- [`app/page.tsx`](app/page.tsx) renders the "watched by both" section with
  three view toggles — **Grid** (posters, sortable/filterable by
  decade/genre/rating), **Face to Face** (a table of both ratings side by
  side), and **Scatter** ([`components/CompareScatterChart.tsx`](components/CompareScatterChart.tsx),
  ported from the old `scatter-duo` app) — and the "on both watchlists"
  section as a grid only.

## Local development

```sh
npm install
npm run dev
```

## Deploy

Self-hosted via Docker (multi-stage build: Next.js standalone output +
Playwright's Chromium) behind a Cloudflare Tunnel. See
`../homeserver/docker-compose.yml`.
