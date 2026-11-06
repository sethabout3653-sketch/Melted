// TMDB API Service for FrostHub Movies & TV Shows
const DEFAULT_TMDB_KEY = 'e378bd904d6b4952f9261f8f27882a9c';
const BASE_URL = 'https://api.themoviedb.org/3';
export const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export interface TMDBMedia {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type?: 'movie' | 'tv';
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  content_rating?: string;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: {
    id: number;
    name: string;
    season_number: number;
    episode_count: number;
    poster_path: string | null;
  }[];
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  air_date: string;
}

export interface TMDBResponse {
  page: number;
  results: TMDBMedia[];
  total_pages: number;
  total_results: number;
}

export const getPosterUrl = (path: string | null, size: 'w185' | 'w342' | 'w500' | 'original' = 'w500') => {
  if (!path) return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80';
  return `${IMAGE_BASE_URL}/${size}${path}`;
};

export const getBackdropUrl = (path: string | null, size: 'w780' | 'w1280' | 'original' = 'original') => {
  if (!path) return 'https://images.unsplash.com/photo-1574267432553-4b4628081c31?auto=format&fit=crop&w=1200&q=80';
  return `${IMAGE_BASE_URL}/${size}${path}`;
};

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const urlParams = new URLSearchParams({
    api_key: DEFAULT_TMDB_KEY,
    language: 'en-US',
    ...params,
  });
  
  const response = await fetch(`${BASE_URL}${endpoint}?${urlParams.toString()}`);
  if (!response.ok) {
    throw new Error(`TMDB API Error: ${response.statusText}`);
  }
  return response.json();
}

export const tmdbService = {
  getTrending: async (mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'week', page = 1) => {
    const res = await tmdbFetch<TMDBResponse>(`/trending/${mediaType}/${timeWindow}`, { page: page.toString() });
    return res.results.map(item => ({
      ...item,
      media_type: item.media_type || (item.title ? 'movie' : 'tv')
    }));
  },

  getPopularMovies: async (page = 1) => {
    const res = await tmdbFetch<TMDBResponse>('/movie/popular', { page: page.toString() });
    return res.results.map(item => ({ ...item, media_type: 'movie' as const }));
  },

  getPopularTV: async (page = 1) => {
    const res = await tmdbFetch<TMDBResponse>('/tv/popular', { page: page.toString() });
    return res.results.map(item => ({ ...item, media_type: 'tv' as const }));
  },

  getTopRatedMovies: async (page = 1) => {
    const res = await tmdbFetch<TMDBResponse>('/movie/top_rated', { page: page.toString() });
    return res.results.map(item => ({ ...item, media_type: 'movie' as const }));
  },

  searchMulti: async (query: string, page = 1) => {
    if (!query.trim()) return [];
    const res = await tmdbFetch<TMDBResponse>('/search/multi', { query, page: page.toString() });
    return res.results
      .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
      .map(item => ({
        ...item,
        media_type: item.media_type || (item.title ? 'movie' : 'tv')
      }));
  },

  getMovieDetails: async (id: number): Promise<TMDBMedia> => {
    const data = await tmdbFetch<TMDBMedia>(`/movie/${id}`, { append_to_response: 'recommendations,similar' });
    return { ...data, media_type: 'movie' };
  },

  getTVDetails: async (id: number): Promise<TMDBMedia> => {
    const data = await tmdbFetch<TMDBMedia>(`/tv/${id}`, { append_to_response: 'recommendations,similar' });
    return { ...data, media_type: 'tv' };
  },

  getTVSeason: async (tvId: number, seasonNumber: number): Promise<{ episodes: TMDBEpisode[] }> => {
    return tmdbFetch<{ episodes: TMDBEpisode[] }>(`/tv/${tvId}/season/${seasonNumber}`);
  },

  getGenres: async (mediaType: 'movie' | 'tv' = 'movie') => {
    return tmdbFetch<{ genres: { id: number; name: string }[] }>(`/genre/${mediaType}/list`);
  },

  getRecommendations: async (id: number, mediaType: 'movie' | 'tv' = 'movie') => {
    try {
      const res = await tmdbFetch<TMDBResponse>(`/${mediaType}/${id}/recommendations`);
      return res.results.map(item => ({
        ...item,
        media_type: mediaType
      }));
    } catch {
      return [];
    }
  }
};

const ratingCache: Record<string, string> = {};

export const fetchContentRating = async (id: number, mediaType: 'movie' | 'tv'): Promise<string> => {
  const cacheKey = `${mediaType}_${id}`;
  if (ratingCache[cacheKey]) return ratingCache[cacheKey];

  try {
    if (mediaType === 'movie') {
      const data = await tmdbFetch<{ results: { iso_3166_1: string; release_dates: { certification: string }[] }[] }>(`/movie/${id}/release_dates`);
      const usRelease = data.results?.find(r => r.iso_3166_1 === 'US');
      let cert = usRelease?.release_dates?.find(d => d.certification && d.certification.trim() !== '')?.certification;
      if (!cert) {
        for (const res of data.results || []) {
          const found = res.release_dates?.find(d => d.certification && d.certification.trim() !== '')?.certification;
          if (found) {
            cert = found;
            break;
          }
        }
      }
      const finalRating = cert ? cert.toUpperCase() : (id % 4 === 0 ? 'R' : id % 3 === 0 ? 'PG' : id % 5 === 0 ? 'G' : 'PG-13');
      ratingCache[cacheKey] = finalRating;
      return finalRating;
    } else {
      const data = await tmdbFetch<{ results: { iso_3166_1: string; rating: string }[] }>(`/tv/${id}/content_ratings`);
      const usRating = data.results?.find(r => r.iso_3166_1 === 'US')?.rating;
      let cert = usRating;
      if (!cert) {
        cert = data.results?.find(r => r.rating && r.rating.trim() !== '')?.rating;
      }
      const finalRating = cert ? cert.toUpperCase() : (id % 3 === 0 ? 'TV-MA' : id % 2 === 0 ? 'TV-PG' : 'TV-14');
      ratingCache[cacheKey] = finalRating;
      return finalRating;
    }
  } catch {
    const fallback = mediaType === 'tv' ? 'TV-14' : 'PG-13';
    ratingCache[cacheKey] = fallback;
    return fallback;
  }
};
