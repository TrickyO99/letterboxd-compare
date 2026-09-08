const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

export interface TmdbEnrichment {
  posterUrl: string | null;
  genres: string[];
  tmdbRating: number | null;
}

const EMPTY: TmdbEnrichment = { posterUrl: null, genres: [], tmdbRating: null };

let genreMapPromise: Promise<Map<number, string>> | null = null;

function getGenreMap(): Promise<Map<number, string>> {
  if (!genreMapPromise) {
    genreMapPromise = fetch(`${TMDB_BASE}/genre/movie/list?api_key=${TMDB_API_KEY}`)
      .then((res) => res.json())
      .then(
        (data: { genres?: { id: number; name: string }[] }) =>
          new Map((data.genres ?? []).map((g) => [g.id, g.name]))
      )
      .catch(() => new Map<number, string>());
  }
  return genreMapPromise;
}

interface TmdbSearchResult {
  poster_path: string | null;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
}

async function enrichFilm(name: string, year: number | null): Promise<TmdbEnrichment> {
  if (!TMDB_API_KEY) return EMPTY;

  try {
    const params = new URLSearchParams({ api_key: TMDB_API_KEY, query: name });
    if (year) params.set("primary_release_year", String(year));

    const res = await fetch(`${TMDB_BASE}/search/movie?${params.toString()}`);
    if (!res.ok) return EMPTY;

    const data = (await res.json()) as { results?: TmdbSearchResult[] };
    const match = data.results?.[0];
    if (!match) return EMPTY;

    const genreMap = await getGenreMap();
    const genres = (match.genre_ids ?? [])
      .map((id) => genreMap.get(id))
      .filter((g): g is string => Boolean(g));

    return {
      posterUrl: match.poster_path ? `${IMAGE_BASE}${match.poster_path}` : null,
      genres,
      tmdbRating: match.vote_count && match.vote_count > 0 ? Math.round(match.vote_average! * 10) / 10 : null,
    };
  } catch {
    return EMPTY;
  }
}

// TMDB's free tier is generous (no strict rate limit for reasonable use), but
// a small concurrency cap keeps things polite for larger match lists.
const CONCURRENCY = 5;

export async function enrichFilms<T extends { name: string; year: number | null }>(
  films: T[]
): Promise<(T & TmdbEnrichment)[]> {
  const results: (T & TmdbEnrichment)[] = new Array(films.length);
  let next = 0;

  async function worker() {
    while (next < films.length) {
      const i = next++;
      const enrichment = await enrichFilm(films[i].name, films[i].year);
      results[i] = { ...films[i], ...enrichment };
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, films.length) }, worker));
  return results;
}
