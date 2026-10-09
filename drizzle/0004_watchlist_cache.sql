CREATE TABLE watchlist_cache (
 cache_key text PRIMARY KEY NOT NULL,
 saved_at text NOT NULL,
 data_json text NOT NULL
);
