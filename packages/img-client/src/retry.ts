/**
 * Backoff schedule for a variant request that failed outright.
 *
 * The failure this exists for is a cache miss the server answers slowly: generating a
 * flattened rendition of an svg-with-raster source costs seconds when no pre-rendered
 * master is available, and Safari drops the request before it lands. Nothing about the
 * URL is wrong, so a plain retry succeeds — the server finishes the generation it
 * already started (a disconnected client doesn't cancel it) and the next attempt is a
 * cache hit. Without a retry the caller is stuck showing its LQIP until a full reload.
 *
 * Deliberately short and finite: a genuinely missing source should settle into "keep
 * showing the blur" quickly rather than retrying forever behind the user's back.
 */
export const RETRY_DELAYS_MS = [800, 2500, 6000];
