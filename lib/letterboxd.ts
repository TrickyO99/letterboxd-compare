import * as cheerio from "cheerio";
import { getContext } from "./browser";

const BASE_URL = "https://letterboxd.com";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{1,32}$/;

export type LetterboxdErrorCode = "invalid_username" | "not_found" | "private" | "upstream_error";

export class LetterboxdError extends Error {
  code: LetterboxdErrorCode;
  username: string;

  constructor(code: LetterboxdErrorCode, username: string, message: string) {
    super(message);
    this.code = code;
    this.username = username;
  }
}

export interface FilmEntry {
  slug: string;
  name: string;
  year: number | null;
  link: string;
  /** This list owner's own star rating for the film (0.5-5, half-star steps), or null if unrated. */
  userRating: number | null;
}

export type ListSection = "films" | "watchlist";

export function assertValidUsername(username: string): string {
  const trimmed = username.trim();
  if (!USERNAME_PATTERN.test(trimmed)) {
    throw new LetterboxdError(
      "invalid_username",
      trimmed,
      `"${username}" doesn't look like a valid Letterboxd username.`
    );
  }
  return trimmed;
}

const RETRYABLE_STATUSES = new Set([403, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cloudflare (fronting letterboxd.com) rate-limits requests from one source
// by both concurrency and sustained rate. This limiter caps concurrent
// in-flight requests AND paces how often a new one can start, regardless of
// how many pages/users are being fetched at once.
class RateLimiter {
  private available: number;
  private waiters: (() => void)[] = [];
  private nextSlotAt = 0;

  constructor(
    private maxConcurrent: number,
    private minIntervalMs: number
  ) {
    this.available = maxConcurrent;
  }

  async acquire(): Promise<() => void> {
    if (this.available <= 0) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.available--;

    const now = Date.now();
    const waitMs = Math.max(0, this.nextSlotAt - now);
    this.nextSlotAt = Math.max(now, this.nextSlotAt) + this.minIntervalMs;
    if (waitMs > 0) await sleep(waitMs);

    return () => {
      this.available++;
      const next = this.waiters.shift();
      if (next) next();
    };
  }
}

// Watchlist pagination tolerates a fast, moderately-concurrent pace just
// fine. "films" pagination gets hard-blocked almost immediately in
// practice — observed consistently across many test runs, with two users'
// films streams running concurrently seemingly compounding the problem —
// suggesting a much stricter, path-specific rate-limit rule upstream. Give
// films its own fully-serialized, slow-paced lane, shared across every user
// in the whole app, independent of the faster watchlist lane.
const watchlistLimiter = new RateLimiter(2, 300);
const filmsLimiter = new RateLimiter(1, 7000);

function limiterFor(path: string): RateLimiter {
  return path.includes("/films/") ? filmsLimiter : watchlistLimiter;
}

function isCloudflareChallenge(body: string): boolean {
  return body.includes("Just a moment") || body.includes("challenges.cloudflare.com");
}

// A real Chromium instance (via Playwright) presents a genuine browser TLS/JS
// fingerprint, which Cloudflare's bot protection (fronting letterboxd.com)
// reliably let through — unlike a plain Node/curl request, which gets 403'd
// after a handful of sequential requests in the same session. Occasionally
// Cloudflare still serves an interactive JS challenge ("Just a moment...");
// a real browser resolves that client-side within a few seconds and gets a
// clearance cookie, so we wait it out and reload rather than treating the
// interstitial itself as the response.
async function rawGet(path: string, referer?: string): Promise<{ status: number; body: string }> {
  const context = await getContext();
  const page = await context.newPage();
  try {
    let response = await page.goto(`${BASE_URL}${path}`, {
      waitUntil: "domcontentloaded",
      referer,
    });
    let body = await page.content();

    for (let i = 0; i < 2 && isCloudflareChallenge(body); i++) {
      await page.waitForTimeout(6000);
      response = await page.reload({ waitUntil: "domcontentloaded" });
      body = await page.content();
    }

    const status = response?.status() ?? 0;
    return { status, body };
  } finally {
    await page.close();
  }
}

async function fetchHtml(path: string, username: string, referer: string | undefined, deadline: number): Promise<string> {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (Date.now() > deadline) {
      throw new LetterboxdError(
        "upstream_error",
        username,
        `Ran out of time waiting on Letterboxd while loading "${username}".`
      );
    }
    const release = await limiterFor(path).acquire();
    let status: number;
    let body: string;
    try {
      ({ status, body } = await rawGet(path, referer));
    } catch {
      status = 0;
      body = "";
    } finally {
      release();
    }

    if (status === 0) {
      lastStatus = 0;
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(2000 * attempt);
      continue;
    }

    if (status === 404) {
      throw new LetterboxdError("not_found", username, `Letterboxd user "${username}" wasn't found.`);
    }
    if (status === 403 && body.includes("template'] = '/errors/forbidden'")) {
      throw new LetterboxdError(
        "private",
        username,
        `${username}'s list at this URL is private.`
      );
    }
    if (status >= 200 && status < 300) {
      return body;
    }

    lastStatus = status;
    if (!RETRYABLE_STATUSES.has(status) || attempt === MAX_ATTEMPTS) {
      break;
    }
    await sleep(2000 * attempt);
  }

  throw new LetterboxdError(
    "upstream_error",
    username,
    `Letterboxd returned an error (${lastStatus}) while loading "${username}". It may be temporarily blocking requests — try again in a moment.`
  );
}

function parseFilmGrid(html: string): FilmEntry[] {
  const $ = cheerio.load(html);
  const entries: FilmEntry[] = [];

  $("li.griditem").each((_, li) => {
    const node = $(li).find('.react-component[data-component-class="LazyPoster"]').first();
    const slug = node.attr("data-item-slug");
    const itemName = node.attr("data-item-name");
    const link = node.attr("data-item-link");
    if (!slug || !itemName || !link) return;

    const yearMatch = itemName.match(/\((\d{4})\)\s*$/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
    const name = yearMatch ? itemName.slice(0, yearMatch.index).trim() : itemName.trim();

    const ratingClass = $(li)
      .find("p.poster-viewingdata span.rating")
      .attr("class");
    const ratingMatch = ratingClass?.match(/rated-(\d+)/);
    const userRating = ratingMatch ? parseInt(ratingMatch[1], 10) / 2 : null;

    entries.push({ slug, name, year, link: `${BASE_URL}${link}`, userRating });
  });

  return entries;
}

function getLastPage(html: string): number {
  const $ = cheerio.load(html);
  let last = 1;
  $(".paginate-pages a").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/\/page\/(\d+)\//);
    if (match) {
      const page = parseInt(match[1], 10);
      if (page > last) last = page;
    }
  });
  return last;
}

export interface FetchListResult {
  entries: FilmEntry[];
  /** True if pagination was cut short (e.g. blocked) before reaching the last page. */
  incomplete: boolean;
}

// Effectively "unconstrained" for callers that don't pass a deadline (e.g.
// local dev / tooling scripts).
const DEFAULT_DEADLINE_MS = 10 * 60_000;

export async function fetchList(
  username: string,
  section: ListSection,
  deadline: number = Date.now() + DEFAULT_DEADLINE_MS
): Promise<FetchListResult> {
  const safeUsername = assertValidUsername(username);
  const profileUrl = `${BASE_URL}/${safeUsername}/`;
  const firstPageHtml = await fetchHtml(`/${safeUsername}/${section}/`, safeUsername, profileUrl, deadline);

  const entries = parseFilmGrid(firstPageHtml);
  const lastPage = getLastPage(firstPageHtml);
  const byslug = new Map<string, FilmEntry>();
  for (const entry of entries) byslug.set(entry.slug, entry);

  let referer = `${BASE_URL}/${safeUsername}/${section}/`;
  let incomplete = false;
  for (let page = 2; page <= lastPage; page++) {
    if (Date.now() > deadline) {
      incomplete = true;
      break;
    }
    let html: string;
    try {
      html = await fetchHtml(`/${safeUsername}/${section}/page/${page}/`, safeUsername, referer, deadline);
    } catch (err) {
      if (err instanceof LetterboxdError && err.code === "upstream_error") {
        // Letterboxd/Cloudflare blocked further pagination (or we ran out of
        // time) — keep what we already have rather than discarding a
        // partial result.
        incomplete = true;
        break;
      }
      throw err;
    }
    referer = `${BASE_URL}/${safeUsername}/${section}/page/${page}/`;
    for (const entry of parseFilmGrid(html)) byslug.set(entry.slug, entry);
  }

  return { entries: Array.from(byslug.values()), incomplete };
}

export function intersectBySlug(a: FilmEntry[], b: FilmEntry[]): FilmEntry[] {
  const bSlugs = new Set(b.map((f) => f.slug));
  const result = a.filter((f) => bSlugs.has(f.slug));
  result.sort((x, y) => {
    const yearDiff = (y.year ?? 0) - (x.year ?? 0);
    if (yearDiff !== 0) return yearDiff;
    return x.name.localeCompare(y.name);
  });
  return result;
}

export interface FilmWithBothRatings extends FilmEntry {
  ratingA: number | null;
  ratingB: number | null;
}

/** Like intersectBySlug, but keeps each side's own rating for the shared film. */
export function intersectWithRatings(a: FilmEntry[], b: FilmEntry[]): FilmWithBothRatings[] {
  const bBySlug = new Map(b.map((f) => [f.slug, f]));
  const result: FilmWithBothRatings[] = [];
  for (const filmA of a) {
    const filmB = bBySlug.get(filmA.slug);
    if (!filmB) continue;
    result.push({ ...filmA, ratingA: filmA.userRating, ratingB: filmB.userRating });
  }
  result.sort((x, y) => {
    const yearDiff = (y.year ?? 0) - (x.year ?? 0);
    if (yearDiff !== 0) return yearDiff;
    return x.name.localeCompare(y.name);
  });
  return result;
}
