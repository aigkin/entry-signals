# Technical review update — 2026-10-07

The home cards now retain the most recent historical technical-candidate onset, trading-session age and current unmet or unknown conditions. Detailed review shows a recent candidate timeline, both technical-path checklists, and complementary trend/volatility indicators.

## Three separate concepts

- Chart markers: stock-only price/volume clues, calculated by PriceClues.
- Technical candidates: dip clues, or trend clues with same-date SPY and SOXX above SMA50; continuous qualifying days are collapsed to the first day.
- Full confirmation: the existing EntryEngine conditions plus research. Industry breadth remains unavailable; no substitute is fabricated.

Historical reconstructions use only bars available through each date. They are not contemporaneous alerts, completed trades, performance backtests or sell signals. At most the latest 12 onsets are returned. Cached/stale/review data cannot confirm current conditions. The existing 45% discontinuity guard remains in force.

## Additional evidence, not new entry gates

- EMA20: first 20 closes seed a simple mean; alpha = 2/21 thereafter.
- SMA50 slope: percentage change of the 50-day simple mean from five sessions earlier.
- SMA200: unknown until 200 observations are available.
- Relative strength: ((stock latest / stock 20-session-prior) / (SOXX same-end / SOXX same-start) - 1) × 100. Exact endpoint dates must match. This is not RSI or a percentage-point difference.
- ATR14: true range includes gaps from previous close; initial mean of 14 ranges followed by Wilder smoothing (13 × prior ATR + TR) / 14.
- Extension: (close - EMA20) / ATR14; descriptive, with no invented threshold.

The original 10% SMA50 extension cap, 1.2 trend volume ratio and dip requirements are unchanged. Raw OHLC is used consistently; research and breadth need separate data work. No claim of out-of-sample validity is made.

References: Fidelity EMA indicator guide and Schwab Average True Range and Volatility, linked directly from the review panel.

## Verification

61 tests passed, including seven new tests for exact seeds, gap-aware ATR, same-date confirmation, missing benchmark dates, missing benchmark volume, no lookahead, cached/abnormal data and relative-strength endpoint alignment. Four legacy assertions were updated from obsolete buy/probe wording to current human-review behavior; production EntryEngine logic was not changed. Built Worker asset routes returned HTTP 200. Local browser review used explicitly labeled 2026-10-06 snapshots, including NVDA details and compact layout.
