"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CompareScatterChart, type ScatterPoint } from "@/components/CompareScatterChart";

interface FilmEntry {
  slug: string;
  name: string;
  year: number | null;
  link: string;
  posterUrl: string | null;
  genres: string[];
  tmdbRating: number | null;
  ratingA?: number | null;
  ratingB?: number | null;
}

interface UserSummary {
  username: string;
  watchedCount: number;
  watchlistCount: number;
  watchedPrivate: boolean;
  watchlistPrivate: boolean;
  watchedIncomplete: boolean;
  watchlistIncomplete: boolean;
}

interface CompareResult {
  userA: UserSummary;
  userB: UserSummary;
  watchedBoth: FilmEntry[];
  watchlistBoth: FilmEntry[];
}

interface ApiError {
  error: string;
}

export default function Home() {
  const [userA, setUserA] = useState("");
  const [userB, setUserB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userA.trim() || !userB.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userA, userB }),
      });
      const data = (await res.json()) as CompareResult | ApiError;
      if (!res.ok) {
        setError((data as ApiError).error ?? "Something went wrong.");
        return;
      }
      setResult(data as CompareResult);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="relative z-10 px-4 pt-6 sm:px-8">
        <a
          href="https://odtriki.com"
          className="inline-flex items-center gap-2 font-serif text-sm font-semibold"
          style={{ color: "var(--cream)" }}
        >
          <span aria-hidden className="inline-block h-2 w-2 rounded-[2px]" style={{ background: "var(--orange)" }} />
          Othmane Triki
        </a>
      </header>

    <div className="relative z-10 min-h-screen text-[var(--muted)] flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-3xl flex flex-col items-center text-center gap-3 mb-10">
        <p
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] mb-1"
          style={{ color: "var(--orange)" }}
        >
          <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-3.5 w-3.5">
            <circle cx="8" cy="11" r="6" /><circle cx="14" cy="11" r="6" />
          </svg>
          Letterboxd, overlapped
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight" style={{ color: "var(--cream)" }}>
          Letterboxd <span style={{ color: "var(--orange)" }}>Compare</span>
        </h1>
        <p className="text-[var(--text-muted)] max-w-md">
          Compare two Letterboxd profiles to find the films you&apos;ve both watched, the films you&apos;re both waiting to see, and how your ratings stack up.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4"
      >
        <input
          value={userA}
          onChange={(e) => setUserA(e.target.value)}
          placeholder="letterboxd username"
          className="flex-1 rounded-md bg-[var(--card)] backdrop-blur-xl backdrop-saturate-150 border border-[var(--border)] px-4 py-3 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--orange)]"
          disabled={loading}
        />
        <span className="text-[var(--text-muted)] text-sm font-medium self-center">vs</span>
        <input
          value={userB}
          onChange={(e) => setUserB(e.target.value)}
          placeholder="letterboxd username"
          className="flex-1 rounded-md bg-[var(--card)] backdrop-blur-xl backdrop-saturate-150 border border-[var(--border)] px-4 py-3 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--orange)]"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !userA.trim() || !userB.trim()}
          className="rounded-full bg-[var(--orange)] text-[var(--ink)] font-semibold px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--accent-primary-hover)] transition-colors"
        >
          {loading ? "Comparing…" : "Compare"}
        </button>
      </form>

      {error && (
        <p className="w-full max-w-xl text-center text-[var(--danger)] bg-[var(--card)] backdrop-blur-xl backdrop-saturate-150 border border-[var(--danger)] rounded-full px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {loading && (
        <p className="text-[var(--text-muted)] text-sm">
          Fetching profiles from Letterboxd — this can take a little while for large accounts…
        </p>
      )}

      {result && (
        <div className="w-full max-w-6xl flex flex-col gap-12 mt-6">
          <div className="flex justify-center gap-8 text-sm text-[var(--text-muted)]">
            <span>
              <strong className="text-white">{result.userA.username}</strong>: {result.userA.watchedCount} watched, {result.userA.watchlistCount} on watchlist
            </span>
            <span>
              <strong className="text-white">{result.userB.username}</strong>: {result.userB.watchedCount} watched, {result.userB.watchlistCount} on watchlist
            </span>
          </div>

          <ResultSection
            title="Movies you've both watched"
            emoji="🎬"
            films={result.watchedBoth}
            notice={sectionNotice(result.userA, result.userB, "watchedPrivate", "watchedIncomplete", "films")}
            ratingComparison={{ userAName: result.userA.username, userBName: result.userB.username }}
          />
          <ResultSection
            title="On both your watchlists"
            emoji="📋"
            films={result.watchlistBoth}
            notice={sectionNotice(result.userA, result.userB, "watchlistPrivate", "watchlistIncomplete", "watchlist")}
          />
        </div>
      )}
    </div>

      <footer
        className="relative z-10 border-t px-4 py-8 text-center text-sm sm:px-8"
        style={{ borderColor: "var(--border)", color: "var(--muted)", background: "rgba(15,25,90,0.35)" }}
      >
        <a href="https://odtriki.com" className="font-medium hover:text-[var(--orange)]" style={{ color: "var(--cream)" }}>
          odtriki.com
        </a>
        <span aria-hidden className="inline-block mx-2 h-1 w-1 rounded-[1px] align-middle" style={{ background: "var(--orange)" }} />
        one of a few side projects
      </footer>
    </>
  );
}

function sectionNotice(
  userA: UserSummary,
  userB: UserSummary,
  privateKey: "watchedPrivate" | "watchlistPrivate",
  incompleteKey: "watchedIncomplete" | "watchlistIncomplete",
  label: string
): string | null {
  const privateUsers = [userA, userB].filter((u) => u[privateKey]).map((u) => u.username);
  const incompleteUsers = [userA, userB].filter((u) => u[incompleteKey]).map((u) => u.username);

  const parts: string[] = [];
  if (privateUsers.length > 0) {
    parts.push(`${privateUsers.join(" and ")} ${privateUsers.length > 1 ? "have" : "has"} their ${label} list set to private`);
  }
  if (incompleteUsers.length > 0) {
    parts.push(`Letterboxd temporarily limited how much of ${incompleteUsers.join(" and ")}'s ${label} history could be loaded`);
  }
  if (parts.length === 0) return null;
  return `${parts.join("; ")} — this comparison may be incomplete.`;
}

type SortKey = "name-asc" | "name-desc" | "year-desc" | "year-asc" | "rating-desc" | "rating-asc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "year-desc", label: "Release Date (Newest)" },
  { value: "year-asc", label: "Release Date (Oldest)" },
  { value: "rating-desc", label: "Rating (Highest)" },
  { value: "rating-asc", label: "Rating (Lowest)" },
];

function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

function ResultSection({
  title,
  emoji,
  films,
  notice,
  ratingComparison,
}: {
  title: string;
  emoji: string;
  films: FilmEntry[];
  notice: string | null;
  ratingComparison?: { userAName: string; userBName: string };
}) {
  const [sortBy, setSortBy] = useState<SortKey>("name-asc");
  const [decade, setDecade] = useState<string>("all");
  const [activeGenres, setActiveGenres] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"grid" | "faceoff" | "scatter">("grid");

  const decades = useMemo(() => {
    const set = new Set<number>();
    for (const f of films) if (f.year) set.add(decadeOf(f.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [films]);

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const f of films) for (const g of f.genres) set.add(g);
    return Array.from(set).sort();
  }, [films]);

  const filteredFilms = useMemo(() => {
    let list = films;
    if (decade !== "all") {
      const d = parseInt(decade, 10);
      list = list.filter((f) => f.year !== null && decadeOf(f.year) === d);
    }
    if (activeGenres.size > 0) {
      list = list.filter((f) => f.genres.some((g) => activeGenres.has(g)));
    }
    return list;
  }, [films, decade, activeGenres]);

  const visibleFilms = useMemo(() => {
    const sorted = [...filteredFilms];
    sorted.sort((x, y) => {
      switch (sortBy) {
        case "name-asc":
          return x.name.localeCompare(y.name);
        case "name-desc":
          return y.name.localeCompare(x.name);
        case "year-desc":
          return (y.year ?? -Infinity) - (x.year ?? -Infinity);
        case "year-asc":
          return (x.year ?? Infinity) - (y.year ?? Infinity);
        case "rating-desc":
          return (y.tmdbRating ?? -Infinity) - (x.tmdbRating ?? -Infinity);
        case "rating-asc":
          return (x.tmdbRating ?? Infinity) - (y.tmdbRating ?? Infinity);
      }
    });
    return sorted;
  }, [filteredFilms, sortBy]);

  // Only films both users actually rated (not just watched) can plot on a
  // ratings scatter — an unrated watch has nothing to put on that axis.
  const scatterPoints = useMemo((): ScatterPoint[] => {
    const points: ScatterPoint[] = [];
    for (const f of filteredFilms) {
      if (f.ratingA == null || f.ratingB == null) continue;
      points.push({
        slug: f.slug,
        name: f.name,
        year: f.year,
        link: f.link,
        posterUrl: f.posterUrl,
        rating1: f.ratingA,
        rating2: f.ratingB,
      });
    }
    return points;
  }, [filteredFilms]);

  function toggleGenre(genre: string) {
    setActiveGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-xl font-semibold text-white">
          {emoji} {title} <span className="text-[var(--text-muted)] font-normal">({films.length})</span>
        </h2>

        {ratingComparison && films.length > 0 && (
          <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`px-3 py-1.5 transition-colors ${view === "grid" ? "bg-[var(--orange)] text-[var(--ink)] font-medium" : "bg-[var(--card)] text-[var(--muted)] hover:text-white"}`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setView("faceoff")}
              className={`px-3 py-1.5 transition-colors ${view === "faceoff" ? "bg-[var(--orange)] text-[var(--ink)] font-medium" : "bg-[var(--card)] text-[var(--muted)] hover:text-white"}`}
            >
              Face to Face
            </button>
            <button
              type="button"
              onClick={() => setView("scatter")}
              className={`px-3 py-1.5 transition-colors ${view === "scatter" ? "bg-[var(--orange)] text-[var(--ink)] font-medium" : "bg-[var(--card)] text-[var(--muted)] hover:text-white"}`}
            >
              Scatter
            </button>
          </div>
        )}
      </div>

      {notice && (
        <p className="text-[var(--muted)] text-xs mb-3 bg-[var(--card)] backdrop-blur-xl backdrop-saturate-150 border border-[var(--border)] rounded-md px-3 py-2">
          {notice}
        </p>
      )}

      {films.length > 0 && view === "grid" && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4 pb-4 border-b border-[var(--border)]">
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            Sort by
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="bg-[var(--card)] border border-[var(--border)] rounded-md px-2 py-1.5 text-[var(--cream)] focus:outline-none focus:border-[var(--orange)]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {decades.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              Decade
              <select
                value={decade}
                onChange={(e) => setDecade(e.target.value)}
                className="bg-[var(--card)] border border-[var(--border)] rounded-md px-2 py-1.5 text-[var(--cream)] focus:outline-none focus:border-[var(--orange)]"
              >
                <option value="all">All</option>
                {decades.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </label>
          )}

          {genres.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--text-muted)]">Genre</span>
              {genres.map((g) => {
                const active = activeGenres.has(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGenre(g)}
                    className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                      active
                        ? "bg-[var(--orange)] text-[var(--ink)] border-[var(--orange)] font-medium"
                        : "bg-transparent text-[var(--muted)] border-[var(--border)] hover:border-[var(--text-muted)]"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {films.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm">No overlap found.</p>
      ) : view === "faceoff" && ratingComparison ? (
        <RatingFaceoff
          films={filteredFilms}
          userAName={ratingComparison.userAName}
          userBName={ratingComparison.userBName}
        />
      ) : view === "scatter" && ratingComparison ? (
        scatterPoints.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">No films rated by both to plot.</p>
        ) : (
          <CompareScatterChart
            points={scatterPoints}
            username1={ratingComparison.userAName}
            username2={ratingComparison.userBName}
          />
        )
      ) : visibleFilms.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm">No films match the current filters.</p>
      ) : (
        <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {visibleFilms.map((film) => (
            <li key={film.slug}>
              <FilmCard film={film} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilmCard({ film }: { film: FilmEntry }) {
  return (
    <a
      href={film.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
      title={`${film.name}${film.year ? ` (${film.year})` : ""}`}
    >
      <div className="aspect-[2/3] rounded-md overflow-hidden bg-[var(--card)] backdrop-blur-xl backdrop-saturate-150 border border-[var(--border)] group-hover:border-[var(--orange)] transition-colors relative">
        {film.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={film.posterUrl}
            alt={film.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-2">
            <span className="text-[var(--text-muted)] text-xs text-center leading-snug">{film.name}</span>
          </div>
        )}
        {film.tmdbRating !== null && (
          <span className="absolute bottom-1 right-1 bg-black/75 text-[var(--orange)] text-[10px] font-semibold rounded px-1.5 py-0.5">
            {film.tmdbRating.toFixed(1)}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-[var(--muted)] leading-snug truncate group-hover:text-white transition-colors">
        {film.name}
      </p>
      {film.year && <p className="text-[10px] text-[var(--text-muted)]">{film.year}</p>}
    </a>
  );
}

type FaceoffSort = "diff-desc" | "diff-asc" | "name-asc";

function diffColor(diff: number): string {
  if (diff === 0) return "text-[var(--text-muted)]";
  if (diff <= 1) return "text-[#e0c060]";
  return "text-[var(--orange)]";
}

function RatingFaceoff({
  films,
  userAName,
  userBName,
}: {
  films: FilmEntry[];
  userAName: string;
  userBName: string;
}) {
  const [sortBy, setSortBy] = useState<FaceoffSort>("diff-desc");

  const rows = useMemo(() => {
    const withDiff = films.map((f) => {
      const a = f.ratingA ?? null;
      const b = f.ratingB ?? null;
      const diff = a !== null && b !== null ? Math.round(Math.abs(a - b) * 2) / 2 : null;
      return { film: f, a, b, diff };
    });

    withDiff.sort((x, y) => {
      if (sortBy === "name-asc") return x.film.name.localeCompare(y.film.name);
      // Rows missing a rating on either side always sort to the bottom.
      if (x.diff === null && y.diff === null) return x.film.name.localeCompare(y.film.name);
      if (x.diff === null) return 1;
      if (y.diff === null) return -1;
      return sortBy === "diff-desc" ? y.diff - x.diff : x.diff - y.diff;
    });
    return withDiff;
  }, [films, sortBy]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 text-xs text-[var(--text-muted)]">
        Sort by
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as FaceoffSort)}
          className="bg-[var(--card)] border border-[var(--border)] rounded-md px-2 py-1.5 text-[var(--cream)] focus:outline-none focus:border-[var(--orange)]"
        >
          <option value="diff-desc">Biggest difference first</option>
          <option value="diff-asc">Smallest difference first</option>
          <option value="name-asc">Name (A–Z)</option>
        </select>
      </div>

      <div className="rounded-md border border-[var(--border)] overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 bg-[var(--card)] text-[10px] uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border)]">
          <span>Film</span>
          <span className="w-14 text-right">{userAName}</span>
          <span className="w-14 text-right">{userBName}</span>
          <span className="w-14 text-right">Diff</span>
        </div>
        <ul>
          {rows.map(({ film, a, b, diff }) => (
            <li
              key={film.slug}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2 border-b border-[var(--card)] last:border-0 hover:bg-[var(--card)]/60"
            >
              <a
                href={film.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 min-w-0 text-white hover:text-[var(--orange)] transition-colors"
              >
                {film.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={film.posterUrl}
                    alt=""
                    className="w-8 h-12 object-cover rounded-sm shrink-0 bg-[var(--card)]"
                    loading="lazy"
                  />
                ) : (
                  <span className="w-8 h-12 rounded-sm shrink-0 bg-[var(--card)] border border-[var(--border)]" />
                )}
                <span className="min-w-0">
                  <span className="block text-sm truncate">{film.name}</span>
                  {film.year && <span className="block text-[10px] text-[var(--text-muted)]">{film.year}</span>}
                </span>
              </a>
              <span className="w-14 text-right text-sm text-[var(--cream)]">{a !== null ? `${a.toFixed(1)} ★` : "—"}</span>
              <span className="w-14 text-right text-sm text-[var(--cream)]">{b !== null ? `${b.toFixed(1)} ★` : "—"}</span>
              <span className={`w-14 text-right text-sm font-semibold ${diff !== null ? diffColor(diff) : "text-[var(--text-muted)]"}`}>
                {diff !== null ? diff.toFixed(1) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
