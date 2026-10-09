import { sqliteTable, text, real, integer, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const dailyBars = sqliteTable('daily_bars', {
  symbol: text('symbol').notNull(), date: text('date').notNull(), source: text('source').notNull(),
  open: real('open').notNull(), high: real('high').notNull(), low: real('low').notNull(), close: real('close').notNull(), volume: real('volume'),
  retrievedAt: text('retrieved_at').notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.symbol, t.date, t.source] }) }));

export const signalSnapshots = sqliteTable('signal_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }), symbol: text('symbol').notNull(), env: text('env').notNull(), ruleVersion: text('rule_version').notNull(), observedAt: text('observed_at').notNull(), observedDay: text('observed_day').notNull(), inputsJson: text('inputs_json').notNull(), sourcesJson: text('sources_json').notNull(), resultJson: text('result_json').notNull(),
}, (t) => ({ dayVersion: uniqueIndex('signal_snapshots_symbol_day_version').on(t.symbol, t.env, t.ruleVersion, t.observedDay) }));

export const researchRecords = sqliteTable('research_records', {
  symbol: text('symbol').primaryKey(), fairValue: real('fair_value'), revision: real('revision'), fiscalYear: text('fiscal_year'),
  broken: text('broken').notNull(), rationale: text('rationale').notNull(), sourceUrl: text('source_url').notNull(),
  asOf: text('as_of').notNull(), expiresOn: text('expires_on').notNull(), updatedAt: text('updated_at').notNull(),
});

export const watchObservations = sqliteTable('watch_observations', {
 id: integer('id').primaryKey({autoIncrement:true}), symbol:text('symbol').notNull(), ruleVersion:text('rule_version').notNull(), marketDate:text('market_date').notNull(), observedAt:text('observed_at').notNull(), dataJson:text('data_json').notNull(),
}, (t) => ({ lookup: index('watch_observations_symbol_rule_id').on(t.symbol,t.ruleVersion,t.id) }));
