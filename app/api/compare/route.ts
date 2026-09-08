import { NextResponse } from "next/server";
import {
  assertValidUsername,
  fetchList,
  intersectBySlug,
  intersectWithRatings,
  LetterboxdError,
  type FilmEntry,
} from "@/lib/letterboxd";
import { enrichFilms } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

interface SectionResult {
  entries: FilmEntry[];
  isPrivate: boolean;
  incomplete: boolean;
}

interface UserData {
  username: string;
  watched: SectionResult;
  watchlist: SectionResult;
}

async function loadSection(
  username: string,
  section: "films" | "watchlist",
  deadline: number
): Promise<SectionResult> {
  try {
    const { entries, incomplete } = await fetchList(username, section, deadline);
    return { entries, isPrivate: false, incomplete };
  } catch (err) {
    if (err instanceof LetterboxdError && err.code === "private") {
      return { entries: [], isPrivate: true, incomplete: false };
    }
    if (err instanceof LetterboxdError && err.code === "upstream_error") {
      // Blocked (or ran out of time) before we could load even the first
      // page — degrade gracefully rather than failing the whole comparison.
      return { entries: [], isPrivate: false, incomplete: true };
    }
    throw err;
  }
}

async function loadUser(username: string, deadline: number): Promise<UserData> {
  const safe = assertValidUsername(username);
  const [watched, watchlist] = await Promise.all([
    loadSection(safe, "films", deadline),
    loadSection(safe, "watchlist", deadline),
  ]);
  return { username: safe, watched, watchlist };
}

export async function POST(req: Request) {
  let body: { userA?: unknown; userB?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawA = typeof body.userA === "string" ? body.userA : "";
  const rawB = typeof body.userB === "string" ? body.userB : "";

  if (!rawA.trim() || !rawB.trim()) {
    return NextResponse.json({ error: "Both Letterboxd usernames are required." }, { status: 400 });
  }

  // Soft deadline so a slow scrape returns a partial result instead of
  // running indefinitely or hitting the Cloudflare Tunnel's edge timeout.
  const deadline = Date.now() + 45_000;

  try {
    const [userA, userB] = await Promise.all([loadUser(rawA, deadline), loadUser(rawB, deadline)]);

    const watchedBoth = intersectWithRatings(userA.watched.entries, userB.watched.entries);
    const watchlistBoth = intersectBySlug(userA.watchlist.entries, userB.watchlist.entries);

    const [enrichedWatchedBoth, enrichedWatchlistBoth] = await Promise.all([
      enrichFilms(watchedBoth),
      enrichFilms(watchlistBoth),
    ]);

    return NextResponse.json({
      userA: {
        username: userA.username,
        watchedCount: userA.watched.entries.length,
        watchlistCount: userA.watchlist.entries.length,
        watchedPrivate: userA.watched.isPrivate,
        watchlistPrivate: userA.watchlist.isPrivate,
        watchedIncomplete: userA.watched.incomplete,
        watchlistIncomplete: userA.watchlist.incomplete,
      },
      userB: {
        username: userB.username,
        watchedCount: userB.watched.entries.length,
        watchlistCount: userB.watchlist.entries.length,
        watchedPrivate: userB.watched.isPrivate,
        watchlistPrivate: userB.watchlist.isPrivate,
        watchedIncomplete: userB.watched.incomplete,
        watchlistIncomplete: userB.watchlist.incomplete,
      },
      watchedBoth: enrichedWatchedBoth,
      watchlistBoth: enrichedWatchlistBoth,
    });
  } catch (err) {
    if (err instanceof LetterboxdError) {
      const status = err.code === "invalid_username" ? 400 : 404;
      return NextResponse.json({ error: err.message, username: err.username, code: err.code }, { status });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong while comparing profiles." }, { status: 500 });
  }
}
