CREATE TABLE daily_bars_new (
 symbol text NOT NULL, date text NOT NULL, source text NOT NULL,
 open real NOT NULL, high real NOT NULL, low real NOT NULL, close real NOT NULL,
 volume real, retrieved_at text NOT NULL,
 PRIMARY KEY(symbol,date,source)
);
--> statement-breakpoint
INSERT INTO daily_bars_new SELECT symbol,date,source,open,high,low,close,volume,retrieved_at FROM daily_bars;
--> statement-breakpoint
DROP TABLE daily_bars;
--> statement-breakpoint
ALTER TABLE daily_bars_new RENAME TO daily_bars;
