CREATE TABLE `watch_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`rule_version` text NOT NULL,
	`market_date` text NOT NULL,
	`observed_at` text NOT NULL,
	`data_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `watch_observations_symbol_rule_id` ON `watch_observations` (`symbol`,`rule_version`,`id`);