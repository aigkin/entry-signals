CREATE TABLE `research_records` (
  `symbol` text PRIMARY KEY NOT NULL, `fair_value` real, `revision` real, `fiscal_year` text,
  `broken` text NOT NULL, `rationale` text NOT NULL, `source_url` text NOT NULL,
  `as_of` text NOT NULL, `expires_on` text NOT NULL, `updated_at` text NOT NULL
);
