CREATE TABLE `daily_bars` (
	`symbol` text NOT NULL,
	`date` text NOT NULL,
	`source` text NOT NULL,
	`open` real NOT NULL,
	`high` real NOT NULL,
	`low` real NOT NULL,
	`close` real NOT NULL,
	`volume` real NOT NULL,
	`retrieved_at` text NOT NULL,
	PRIMARY KEY(`symbol`, `date`, `source`)
);
--> statement-breakpoint
CREATE TABLE `signal_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`env` text NOT NULL,
	`rule_version` text NOT NULL,
	`observed_at` text NOT NULL,
	`observed_day` text NOT NULL,
	`inputs_json` text NOT NULL,
	`sources_json` text NOT NULL,
	`result_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signal_snapshots_symbol_day_version` ON `signal_snapshots` (`symbol`,`env`,`rule_version`,`observed_day`);
