# DataHub Pro — Tools Audit & Enhancement Plan

**Owner:** Waqas Rafique
**Date:** April 2026
**Purpose:** Every user-facing tool in the product, audited end-to-end — what it does today, why it's weak, and the specific state-of-the-art rebuild. Prioritised for you to pick what ships first.

---

## The headline finding

**Four of the five tools branded as "AI" don't actually use AI.**

| Tool | Branded as AI? | Actually calls an LLM? |
|---|---|---|
| Ask Your Data | Yes | **Yes** (Claude Haiku 4.5, but output is stripped of its chart JSON before rendering) |
| AI Insights | Yes | **No** — pure JS, reads `analyticsApi.summary()` and renders three hard-coded cards |
| Auto Report | Yes | **No** — pure JS, same summary stats wrapped in a report template |
| AI Narrative | Yes | **No** — pure JS string concatenation with three "style" wrappers |
| AI Formula Builder | Yes | **No** — drag-and-drop block UI, no LLM. Operator precedence is broken (`2+3*4 = 20`, not `14`) |

Verification: grepped `frontend/src/pages/{AIInsights,AutoReport,AINarrative,FormulaBuilder}*.jsx` for any API call to `/ai/`, `anthropic`, `claude`, `openai`, `gpt-` — **zero matches**. The only network calls are to `filesApi.list()` and `analyticsApi.summary()`.

This is the single biggest quality issue in the product. It also explains exactly the complaint you raised: *"AI tool just reply with most basic info rather than actual insights."* The AI tools **cannot** give insights — they're regex-and-template code. Fixing this is **P0**.

---

## How to read this doc

Each tool gets:

- **Files** — exact paths and line numbers so you can check the work
- **What it does today** — the real behaviour, no marketing gloss
- **Weaknesses** — concrete, each one verifiable from the code
- **Proposed enhancement** — specific, shippable changes (not "make it better")
- **Priority** — P0 (ship now), P1 (next), P2 (later)
- **Effort** — S (<1 day), M (1-3 days), L (3-7 days)

At the end, a prioritisation matrix groups the P0/P1 items so you can pick cohorts to ship.

---

## Tool 1 — Ask Your Data  ⭐ P0

**Files:**
- Backend: `backend/routers/ai.py` (lines 17-231) — only genuine AI endpoint in the product
- Frontend: `frontend/src/pages/AskYourData.jsx`

**What it does today:**
- Sends schema + a 3KB data preview + the user's question to Claude Haiku 4.5
- Streams SSE responses back to the frontend
- Frontend renders as **plain text only** — the system prompt instructs Claude to emit JSON for tables/charts, but a regex in `AskYourData.jsx` line 166 **strips that JSON before rendering**, so charts never appear
- Fallback: if the backend call fails, 14 hard-coded regex patterns try to answer simple sum/avg/count questions locally

**Weaknesses:**
1. **Charts never render.** Backend asks Claude to emit JSON; frontend strips it. Massive wasted capability.
2. **Stateless — no memory between turns.** User can't say "now break that down by segment" because the next message doesn't know what "that" is.
3. **3KB data preview cap.** On a wide dataset (20+ columns), Claude gets a truncated view and hallucinates.
4. **Generic system prompt.** "You are a data analyst." No persona, no role context, no few-shot examples, no guardrails against making up numbers.
5. **max_tokens=2048.** Long answers get cut off mid-sentence.
6. **No per-user usage quota.** Cost risk if a user loops questions.
7. **No suggested follow-ups.** Every answer is a dead-end.
8. **No "show your work".** No way to see what data Claude actually queried.

**Proposed enhancement — "Ask Your Data 2.0":**
1. **Structured tool-use pattern.** Instead of dumping a 3KB sample, let Claude call tools: `get_schema(file_id)`, `run_aggregation(file_id, group_by, metric, agg_fn, filters)`, `run_comparison(file_id, dimension, period_a, period_b)`, `get_sample_rows(file_id, filters, n)`. Claude picks the right tool, backend runs real pandas on real data, returns exact numbers. No hallucination because Claude never does the maths.
2. **Render charts.** Parse the JSON blocks Claude emits and render them with Recharts inline in the chat (bar/line/pie/table widgets the product already has).
3. **Conversation memory.** Keep last 6 turns in context. Pass prior tool results back to Claude so follow-ups work.
4. **Agency-native system prompt.** Persona ("senior insight analyst"), task framing ("user is an insight director presenting to a client — give them the 'so what', not just the 'what'"), guardrails ("never guess a number — always call a tool").
5. **Follow-up chips.** After every answer, suggest 3 follow-up questions (Claude generates these in a dedicated output field).
6. **Transparency panel.** Collapsible "How I got this answer" showing which tools were called, with what args, what they returned.
7. **Per-user monthly token budget** with a soft warning at 80%.
8. Bump `max_tokens` to 4096; Haiku handles it.

**Priority:** P0 | **Effort:** L (5-7 days — backend tool schema + pandas execution + frontend chart parsing + conversation memory)

---

## Tool 2 — AI Insights  ⭐ P0 (rebuild from zero)

**Files:**
- Frontend: `frontend/src/pages/AIInsights.jsx`
- Backend: none — tool has no dedicated endpoint

**What it does today:**
- Calls `analyticsApi.summary(fileId)` — which returns `{rows, cols, per-column min/max/mean/count/unique}`
- Builds 3 static cards from a loop over the summary
- Caps output at 5 numeric columns (`.slice(0, 5)` on line 56)
- Hard-coded bullet templates — e.g. "Column X has a mean of Y and a range of Z"

**Weaknesses:**
1. **Not AI.** Zero LLM calls. Misleading product name.
2. **No anomaly detection.** Doesn't flag outliers, high variance, unexpected nulls, broken trends.
3. **No relational insights.** Never surfaces correlations, top-driver analysis, or segment differences.
4. **Silently hides 6th+ numeric column.** `.slice(0, 5)` — entire tail of the dataset invisible.
5. **No "so what".** Lists descriptive stats; never says *what the user should do about it*.
6. **Static every time.** Same dataset → identical output. No comparison to prior period or to dataset benchmarks.

**Proposed enhancement — "AI Insights 2.0":**
1. **Real LLM call.** New endpoint `POST /api/ai/insights/{file_id}` that runs a structured analysis pass:
   - Backend computes a richer stat pack: percentiles (p10/p50/p90), stddev, skewness, outlier count (z>3), missing %, correlation matrix for numeric cols, top segment driver (if categorical dimension + numeric metric pair detected), month-over-month trend if a date column exists.
   - Send that stat pack + a small sample to Claude with a prompt that asks for: **3 headline findings**, **2 anomalies**, **1 recommended next action per finding**.
2. **Structured output.** Claude returns JSON: `{headlines: [{title, finding, so_what, recommended_action, confidence}], anomalies: [...], questions_to_ask_the_data: [...]}`. Frontend renders as a card deck.
3. **Confidence badges.** Each insight shows high/med/low confidence based on sample size + statistical significance.
4. **"Dig deeper" chips.** Each insight has a one-click button that opens the same insight as a prompt in Ask Your Data for drill-down.
5. **Re-run with context.** Button: "Compare to last period" — if the dataset has a date column, re-run with a period filter so insights show what changed.
6. **Pin to dashboard.** Insights can be pinned onto a custom dashboard as a widget.

**Priority:** P0 | **Effort:** M (2-3 days — backend stat pack is the big chunk; LLM call + frontend cards are small)

---

## Tool 3 — Auto Report  ⭐ P0 (rebuild from zero)

**Files:**
- Frontend: `frontend/src/pages/AutoReport.jsx`
- Backend: none

**What it does today:**
- Same `analyticsApi.summary(fileId)` call
- Pure JS that renders three sections: Dataset Overview (row/col count), Numeric Summary table, Categorical Summary table
- One heuristic: flags "high variance" if range > 5x mean
- Final section is a generic sign-off paragraph

**Weaknesses:**
1. **Not AI.** No LLM.
2. **Not a report.** It's a summary table with two flags. No narrative. No executive section. No charts. No recommendations.
3. **Can't export.** No PDF/PPTX/DOCX output — which is literally what an agency wants.
4. **No branding.** Agencies would forward this to clients; there's no logo slot, no white-label colours, nothing.
5. **Template is static.** Every dataset produces the same 4-section structure.

**Proposed enhancement — "Auto Report 2.0" (the agency-killer feature):**
1. **New endpoint `POST /api/ai/auto-report/{file_id}`** that produces a structured report in JSON:
   - Executive summary (LLM-generated, 3-4 sentences with the "so what")
   - Key metrics panel (3-6 auto-detected KPIs with MoM/YoY trend)
   - 3 headline findings with chart recommendations
   - Segment deep-dive (if categorical dimension found)
   - Anomalies & data quality section
   - Recommendations section (what the reader should do next)
2. **Render in-browser as a polished report page.** Real typography, real charts, not a table dump.
3. **Export to DOCX and PPTX.** Use `python-docx` + `python-pptx` on the backend. Each section maps to styled paragraphs / slides. White-label: the org's logo + brand colour pulled from org settings.
4. **"Regenerate section" button** on each block. If the user doesn't like a heading or finding, they can regenerate it without redoing the whole report.
5. **Save as template.** Once an agency has a report structure they like, save the prompt + section config as a reusable template for future datasets.
6. **Client-safe mode toggle.** Strips raw numbers below a configurable threshold (for agencies that don't want to show clients small-n breakdowns).

**Priority:** P0 | **Effort:** L (4-6 days — DOCX/PPTX generation is the chunk; LLM orchestration is M)

---

## Tool 4 — AI Narrative  ⭐ P1

**Files:**
- Frontend: `frontend/src/pages/AINarrative.jsx`

**What it does today:**
- `analyticsApi.summary(fileId)` → pure JS string concat
- 3 "style" toggles (Executive / Technical / Data Story) — same underlying data, different prose templates
- Hard-coded to top 3 columns only

**Weaknesses:**
1. **Not AI.** Template swap, no generation.
2. **Three styles are cosmetic.** The actual content is identical across them.
3. **No audience control.** User can't say "write this for a non-technical client" or "assume the reader has no statistics background".
4. **Doesn't write about trends or comparisons** — only the current snapshot.

**Proposed enhancement:**
1. **Merge into Auto Report.** Narrative is what Auto Report's "executive summary" section already becomes in the rebuild — no separate tool needed. Kill this page and redirect `/ai/narrative` → Auto Report's narrative block. One fewer "fake AI" surface.
2. OR (if you want to keep it standalone): new endpoint `POST /api/ai/narrative/{file_id}` with inputs `{audience, tone, length, focus_column}` → LLM writes a paragraph tailored to those inputs. Copy-to-clipboard button so users can paste into a deck.

**Priority:** P1 | **Effort:** S (half-day to merge/kill; 1 day for standalone)

---

## Tool 5 — AI Formula Builder  ⭐ P1

**Files:**
- Frontend: `frontend/src/pages/FormulaBuilder.jsx`

**What it does today:**
- Drag-and-drop block UI — columns, numbers, operators (+−×÷), 5 functions (SUM/AVG/ROUND/ABS/IF)
- Evaluates left-to-right on first 10 rows
- **Operator precedence is wrong.** `2 + 3 * 4` evaluates to `20`, not `14`
- No save. No "AI" suggestion layer.

**Weaknesses:**
1. **Not AI.** Misnamed.
2. **Math is broken.** Left-to-right eval gives numerically wrong results on anything more complex than a single operation.
3. **No IF/CASE, no string ops, no date ops.** Missing the 80% of formulas users actually want.
4. **Can't save.** Preview-only.

**Proposed enhancement:**
1. **Fix the evaluator.** Replace with a proper expression parser (use `mathjs` — we already have it available per CLAUDE.md) or a small Pratt parser. Respects precedence, parentheses, function calls.
2. **Add real functions:** `IF`, `CASE WHEN`, `CONCAT`, `UPPER`, `LOWER`, `LEFT`, `RIGHT`, `LEN`, `DATEDIFF`, `YEAR`, `MONTH`, `DAY`, `NOW`, `ROUND`, `CEIL`, `FLOOR`.
3. **Add the "AI" layer (make the name honest).** Input box: "Describe what you want to calculate in plain English." LLM returns the formula expression as a suggestion the user can accept or edit. e.g. *"profit margin as a percentage"* → `(Revenue - Cost) / Revenue * 100`.
4. **Persist to `calculated_fields` table** (the existing backend router already does this — Formula Builder is just disconnected from it; wire them together).
5. **Show errors inline** (divide-by-zero, type mismatch) rather than silently returning null.

**Priority:** P1 | **Effort:** M (2 days — parser + function lib is the bulk; LLM hookup is small)

---

## Tool 6 — KPI Dashboard  ⭐ P0

**Files:**
- Backend: `backend/routers/analytics.py` (lines 86-111, `POST /kpi/{file_id}`)
- Frontend: `frontend/src/pages/KPIDashboard.jsx`

**What it does today:**
- Extracts numeric columns, returns `{sum, mean, min, max}` per column as KPI cards
- Renders bar charts for "Column Sums" and "Column Averages"
- Caps at 8 KPI cards and 6 chart entries

**Weaknesses:**
1. **No trend.** KPI cards show a static number. No MoM %, no YoY %, no sparkline.
2. **No target / threshold.** No red/amber/green status.
3. **Auto-detect only.** User can't label a KPI ("Revenue" instead of raw column name), pick its aggregation function (why is "Cost" shown as a sum when it should be average?), or choose its format (currency / percentage / number).
4. **No drill-down.** Click a KPI → nothing.
5. **No date range picker.** Always shows all-time.

**Proposed enhancement — "KPI Dashboard 2.0":**
1. **Configurable KPIs.** Click "+ Add KPI" → pick column, pick aggregation (sum/avg/min/max/median/count/distinct-count), pick label, pick format (£, %, plain number), pick target.
2. **Trend arrow + sparkline.** If the dataset has a date column, compute MoM and YoY automatically and show a 12-point sparkline under the main figure. Green up-arrow / red down-arrow based on whether increase is "good" (user-configurable per KPI — revenue up = good, CAC up = bad).
3. **Threshold colour.** Set target + tolerance; card shows green/amber/red.
4. **Drill-down on click.** Opens a detail modal: underlying rows, breakdown by top dimension, trend over full period.
5. **Date range picker** at the top of the page; rebuilds all KPIs for the chosen window.
6. **Save as widget.** Any KPI card → "Pin to dashboard" → appears on the user's custom dashboard.

**Priority:** P0 | **Effort:** M (2-3 days)

---

## Tool 7 — Period Comparison  ⭐ P0 (the one you flagged)

**Files:**
- Frontend: `frontend/src/pages/PeriodComparison.jsx`

**What it does today:**
- Groups rows by date column (extracts `YYYY-MM`), sums values per month, calculates MoM growth, shows best/worst month
- Displays: table with Period, Total, Average, Count, Growth %

**Correction to your concern:** the tool *does* actually compare time periods (not just columns). However your frustration is valid because:

**Weaknesses:**
1. **Only monthly granularity.** No quarterly, no yearly, no weekly, no custom periods.
2. **Only MoM growth.** No YoY, no quarter-over-quarter, no "vs. last 12 months avg".
3. **No date range filter.** Always uses whole dataset.
4. **No dimension breakdown.** Can't say "compare Q1 2026 vs Q1 2025 by product category".
5. **No variance decomposition.** Can't see what *drove* the change.
6. **No statistical significance.** 15% MoM growth on 5 rows of data looks the same as 15% on 500,000 rows.

**Proposed enhancement — "Period Comparison 2.0":**
1. **Period granularity selector:** Day / Week / Month / Quarter / Year.
2. **Comparison type selector:** Previous period (MoM) / Same period last year (YoY) / Same period last quarter / Custom (pick two ranges).
3. **Date range picker** — analyse only the data between dates X and Y.
4. **Dimension breakdown panel.** Optional: pick a categorical column → see the comparison broken down by that dimension. (Which product category drove the Q1 lift?)
5. **Variance decomposition ("what changed and why").** When Q1 2026 beats Q1 2025 by 20%, show top 3 categories that contributed most to the delta, with their individual % contribution.
6. **Significance flag.** Show sample size per period; if n<30 in either period, flag the comparison as "low confidence".
7. **Export.** Download the comparison as CSV or send to Ask Your Data for further interrogation.

**Priority:** P0 | **Effort:** M (2-3 days)

---

## Tool 8 — Forecasting  ⭐ P1

**Files:**
- Frontend: `frontend/src/pages/Forecasting.jsx`

**What it does today:**
- 3 algorithms: Simple Moving Average (SMA), Exponential Moving Average (EMA), Linear Trend
- User sets forecast horizon (1-12 periods) and EMA alpha manually
- Uses last 5 values for a crude MAPE validation

**Weaknesses:**
1. **No confidence intervals.** Forecast shows a single line — no upper/lower bound shaded area. Unusable for agency client reporting.
2. **No seasonality.** EMA/SMA can't capture quarterly patterns. On any data with seasonality (retail, tracker studies running quarterly), forecast is badly wrong.
3. **Crude validation.** Last-5-values is not a proper train/test split.
4. **Manual alpha tuning.** User has to guess the smoothing parameter.
5. **No method comparison.** Can't see SMA vs. EMA vs. Linear side-by-side.

**Proposed enhancement:**
1. **Add Holt-Winters (for seasonality).** Available in `statsmodels`. Auto-detects seasonal period from ACF.
2. **Backend-side forecasting endpoint.** Move the maths to Python: `POST /api/analytics/forecast/{file_id}` with `{date_col, value_col, horizon, method, seasonal_period}`. Backend returns point forecast + 80% and 95% prediction intervals.
3. **Confidence bands** rendered as shaded areas on the Recharts line chart.
4. **Auto-method selection.** Run SMA, EMA, Linear, Holt-Winters in parallel, pick the one with lowest backtest MAPE, flag it as "best method". User can override.
5. **Proper backtest.** Last 20% of data as test, rolling-origin validation.
6. **Method-comparison table** — MAPE, MAE, RMSE for each method.

**Priority:** P1 | **Effort:** M (2-3 days — statsmodels is the lift; it's solid, well-tested)

---

## Tool 9 — RFM Analysis  ⭐ P2

**Files:**
- Frontend: `frontend/src/pages/RFMAnalysis.jsx`

**What it does today:**
- Customer ID / date / monetary columns
- Quintile scoring (1-5) for Recency, Frequency, Monetary
- Maps to 5 fixed segments: Champions, Loyal, Potential, At Risk, Lost

**Weaknesses:**
1. **Rigid segments.** Can't add "VIP", "Dormant", "New".
2. **Quintile is arbitrary.** No business-rule-based scoring (e.g. "recency score 5 = purchased in last 30 days").
3. **No actionable next steps.** Each segment just shows a count. No recommended campaign ("At Risk: 1,247 customers. Recommended: win-back email with 15% discount").
4. **No customer list export** per segment.
5. **No time-window control** — always uses all history.

**Proposed enhancement:**
1. **Custom segment builder.** User defines segments with rules: `R>=4 AND F>=4 AND M>=4 → VIP`.
2. **Configurable scoring mode.** Quintile (current) OR business-rule thresholds.
3. **LLM-suggested actions per segment.** Send segment definition + size to Claude → get 3 recommended actions (campaign type, channel, message angle).
4. **Export per segment.** CSV of customer IDs in that segment.
5. **Customer lifetime value (CLV) overlay.** Use simple BG/NBD + Gamma-Gamma (via `lifetimes` lib) to predict 12-month CLV per segment.
6. **Time-window filter.** Restrict to last 6 / 12 / 24 months.

**Priority:** P2 | **Effort:** M (2 days)

---

## Tool 10 — Budget Tracking  ⭐ P2

**Files:**
- Backend: `backend/routers/budget.py`
- Frontend: `frontend/src/pages/BudgetActuals.jsx`

**What it does today:**
- Budget entries with budgeted + actual, variance + variance %
- Filter by period
- CSV upload
- Variance % returns 0 if budgeted=0 (dodges div-by-zero silently)

**Weaknesses:**
1. **No trend view.** Can't see how actuals tracked vs. budget month-by-month.
2. **No alert thresholds.** No flagging of variance > 10%.
3. **No drill-down** by department / category.
4. **No YTD / rolling forecast.**
5. **Variance % silently 0** when budgeted=0 — confusing if the category has actuals but no budget.
6. **Manual CSV only** — no auto-link to source data file.
7. **No budget owner** assignment.

**Proposed enhancement:**
1. **Trend chart** — line chart of actual vs. budget over full period.
2. **Alert configuration** — per-line threshold; over-threshold rows highlighted in red with a reason field.
3. **Department / category drill-down** — collapsible groupings with subtotals.
4. **YTD column** and **rolling 12mo forecast** (spits out predicted year-end variance).
5. **Division-by-zero** → show "no budget" badge instead of 0%.
6. **Link to source file** — optionally auto-pull actuals from a connected dataset rather than CSV paste.

**Priority:** P2 | **Effort:** M (2 days)

---

## Tool 11 — Custom Dashboards  ⭐ P1

**Files:**
- Backend: `backend/routers/dashboards.py`
- Frontend: `frontend/src/pages/DashboardBuilder.jsx` + `Dashboard.jsx`

**What it does today:**
- JSON-backed dashboards with KPI / Bar / Line / Pie / Table widgets
- Public share via permanent UUID token (no expiry, no password)
- Widgets can only be removed, not repositioned

**Weaknesses:**
1. **No drag-reorder** — can only delete + re-add.
2. **No dashboard-level filter.** Filters apply per-widget.
3. **Share token is permanent** — no expiry, no password. Client safety risk.
4. **No widget copy/duplicate.**
5. **Can't share with specific users** — only public link or nothing.
6. **No dashboard templates** — every agency rebuilds the same layout for similar studies.

**Proposed enhancement:**
1. **Drag-to-reorder** with `@dnd-kit/core` (lightweight, no full-grid overkill).
2. **Dashboard-level date filter + dimension filter** at the top; all widgets respect it.
3. **Expiring + password-protected share links.** `POST /dashboards/{id}/share` takes `{expires_at, password}` optional params; public viewer checks password before rendering.
4. **White-label client dashboards.** Org-level brand colour + logo override on shared links.
5. **Widget duplicate button.**
6. **Dashboard templates.** Save a dashboard as a template; new datasets can instantiate against it.

**Priority:** P1 | **Effort:** M (3 days — drag-reorder + filters are most of it)

---

## Tool 12 — Calculated Fields  ⭐ P1

**Files:**
- Backend: `backend/routers/calculated_fields.py`
- Frontend: `frontend/src/pages/CalculatedFields.jsx`

**What it does today:**
- Binary operators only (`+ - * / %`)
- Each operand is a column ref or a constant
- Preview first 50 rows; export CSV
- Division-by-zero returns null silently

**Weaknesses:**
1. **No IF / CASE / string / date functions.**
2. **Can't reference previously-calculated fields.**
3. **Field names unvalidated** — can collide with source columns.
4. **Preview only 50 rows** — misses edge cases in the tail.
5. **Silent null on div-by-zero.**

**Proposed enhancement:** Merge into the Formula Builder rebuild (Tool 5). Same parser, same function library, shared UI. Calculated Fields becomes the "save" target for Formula Builder output — one feature, two entry points.

**Priority:** P1 | **Effort:** S (mostly folded into Tool 5 rebuild — just wire the save)

---

## Tool 13 — Scheduled Reports  ⭐ P2

**Files:**
- Backend: `backend/routers/scheduled_reports.py`
- Frontend: `frontend/src/pages/ScheduledReports.jsx`

**What it does today:**
- Daily / weekly / monthly frequency with day-of-week/month
- Hard-coded HTML email body with stats for top 5 numeric columns
- SendGrid
- No delivery tracking, no retry, no customisation

**Weaknesses:**
1. **Hard-coded email body** — no template system.
2. **No white-labelling.**
3. **No delivery tracking** per recipient.
4. **No retry** on failure.
5. **Stats only over first 500 rows** — tail data missed.
6. **Frequency locked** to daily/weekly/monthly — no "every 2 weeks" or specific time-of-day.
7. **No attachment support** — can't attach the Auto Report PDF.

**Proposed enhancement:**
1. **Template system.** User picks from: KPI digest, Auto Report (PDF attachment), Custom dashboard snapshot.
2. **Email body editor** (WYSIWYG) with brand header + custom intro paragraph.
3. **Delivery log** per recipient per send: delivered / bounced / opened (SendGrid webhooks).
4. **Retry on failure** — 3 retries with exponential backoff.
5. **Full-dataset stats** — remove the 500-row cap.
6. **Cron-level granularity** — frequency as cron string, UI exposes common presets + "custom".
7. **Attachments** — link scheduled reports to the Auto Report output; email arrives with PDF attached.

**Priority:** P2 | **Effort:** M (2-3 days)

---

## Tool 14 — Google Sheets Sync  ⭐ P2

**Files:**
- Backend: `backend/routers/sheets.py`

**What it does today:**
- On-demand manual sync only (button click)
- Full re-download every time
- Requires "anyone with link" public share — blocks enterprise use

**Weaknesses:**
1. **No scheduled auto-sync.**
2. **Full reload** every sync, even if 1 cell changed.
3. **Public-share required** — no Google OAuth for private sheets.
4. **No tab picker** — `gid` URL param implicit.

**Proposed enhancement:**
1. **Scheduled sync** — every N hours, cron-configurable.
2. **Google OAuth** for private sheets (Microsoft OAuth pattern already exists in `sharepoint.py` — copy it).
3. **Tab picker dropdown** after connect.
4. **Sync failure badge** + email to org owner on 3 consecutive failures.

**Priority:** P2 | **Effort:** M (2 days — OAuth is the chunk)

---

## Tool 15 — SharePoint / OneDrive  ⭐ P2

**Files:** `backend/routers/sharepoint.py`

**What it does today:**
- Microsoft OAuth2 with tenant scoping
- File browser, one-time import
- 120s timeout on download (breaks for large files)

**Weaknesses:**
1. **One-time import** — no linked sync (unlike Google Sheets which at least has manual re-sync).
2. **120s timeout** fails for 500MB files.
3. **Raw HTTP error messages** on Microsoft API failures.

**Proposed enhancement:**
1. **Linked sync like Google Sheets** (on-demand + scheduled).
2. **Stream download** for large files (chunked) — remove 120s cap.
3. **User-friendly error mapping** for common Microsoft 401/403/429 responses.

**Priority:** P2 | **Effort:** M (2 days)

---

## Tool 16 — Shopify Connector  ⭐ P1 (security issue)

**Files:** `backend/routers/connectors.py`

**What it does today:**
- Connects to Shopify API; pulls orders, products, customers
- **Access token stored in plaintext in `config_json`** — security issue

**Weaknesses:**
1. **Plaintext token.** If the DB leaks, tokens leak.
2. **No scheduled sync** — manual only.
3. **No incremental sync** — full re-fetch every time.
4. **Raw Shopify error responses** surfaced to user.
5. **Only 3 resource types.**

**Proposed enhancement:**
1. **Encrypt at rest** using Fernet (new `ENCRYPTION_KEY` env var). Simple retrofit.
2. **Scheduled sync** every N hours.
3. **Incremental sync** using Shopify's `updated_at_min` param.
4. **Retry + user-friendly errors.**

**Priority:** P1 | **Effort:** M (2 days — encryption is small, incremental + scheduling is the rest)

---

## Tool 17 — Pipelines  ⭐ P2

**Files:** `backend/routers/pipelines.py`

**What it does today:**
- Steps: remove_nulls, rename_columns, filter_rows, join_datasets
- Left-join only; O(n) scan per left row (slow)
- No step reordering

**Weaknesses:**
1. **No step reordering** — delete and re-add.
2. **Left-join only.**
3. **Slow joins on big datasets.**
4. **No validation before preview** — bad filter silently returns empty.

**Proposed enhancement:**
1. **Drag-reorder steps** (same `@dnd-kit` pattern as dashboards).
2. **Right / inner / outer join** options.
3. **Hash-join implementation** (or just use pandas `merge` on the backend instead of hand-rolling).
4. **Validation on step config** before preview, with inline errors.

**Priority:** P2 | **Effort:** M (2 days)

---

## Tool 18 — File Upload & Management  ⭐ P1

**Files:** `backend/routers/files.py`, `frontend/src/pages/Files.jsx`

**What it does today:**
- Drag-drop + click upload, .xlsx / .xls / .csv, 500MB cap
- Async upload happens silently — no progress bar
- CSV parser uses `errors='ignore'` — corrupted files partially load without warning
- No duplicate detection

**Weaknesses:**
1. **No upload progress indicator.**
2. **No auto-preview** after upload.
3. **Silent CSV encoding errors** — user thinks file loaded fine when rows were dropped.
4. **No duplicate file detection.**

**Proposed enhancement:**
1. **XHR upload progress** via axios `onUploadProgress` → progress bar.
2. **Auto-preview on upload complete** — first 20 rows shown inline with a "Continue to dashboard" button.
3. **Encoding-error report** — if parser drops N rows, show a warning banner with the count.
4. **Duplicate detection** — hash the file; if a file with the same hash already exists in the org, offer "use existing" vs. "upload anyway".

**Priority:** P1 | **Effort:** S (1 day)

---

## Tool 19 — Team / Invites  ⭐ P2

**Files:** `backend/routers/users.py`, `frontend/src/pages/Team.jsx`

**Current behaviour:** invite by email + role, accept flow, no expiry, no resend, no role change after invite, no bulk invite.

**Proposed enhancement:** invite expiry (7 days), resend button, role change on existing user, bulk invite by CSV, pending-invites view, audit log of role changes.

**Priority:** P2 | **Effort:** S (1 day)

---

## Prioritisation matrix — what to build first

### Cohort 1 — "Earn the 'AI' label" (P0, 2-3 weeks)
Kill the fake-AI problem and fix the most-used analytics tool. This cohort alone makes the product genuinely demo-able to an insight agency.

| # | Tool | Effort | Why this wave |
|---|---|---|---|
| 1 | **Ask Your Data 2.0** | L (5-7 d) | Tool-use pattern + chart rendering + memory = 10× the current experience |
| 2 | **AI Insights 2.0** | M (2-3 d) | Real anomaly + trend insights; removes the biggest credibility gap |
| 3 | **Auto Report 2.0** | L (4-6 d) | DOCX/PPTX export is the agency-killer feature — aligns perfectly with Segment A positioning |
| 4 | **Period Comparison 2.0** | M (2-3 d) | Directly addresses your flagged complaint; MoM/YoY + dimension breakdown |
| 5 | **KPI Dashboard 2.0** | M (2-3 d) | Configurable, trended KPIs — turns it from demo-bait into daily-used |

**Total: ~3 weeks of focused build.** Best single cohort to ship because it resolves the "basic info, no insights" complaint end-to-end.

### Cohort 2 — "Make it stick" (P1, 1-2 weeks)
| # | Tool | Effort |
|---|---|---|
| 6 | **Formula Builder (+ Calculated Fields merge)** | M (2 d) |
| 7 | **Custom Dashboards** (reorder + filters + safer sharing) | M (3 d) |
| 8 | **Forecasting** (Holt-Winters + intervals) | M (2-3 d) |
| 9 | **Shopify security** (encrypt tokens) + incremental sync | M (2 d) |
| 10 | **File upload UX** (progress, preview, dedup) | S (1 d) |
| 11 | **AI Narrative** (merge into Auto Report or rebuild standalone) | S (0.5-1 d) |

### Cohort 3 — "Round it out" (P2, 1-2 weeks)
| # | Tool | Effort |
|---|---|---|
| 12 | Scheduled Reports (templates, delivery log, attachments) | M (2-3 d) |
| 13 | RFM (custom segments, LLM actions, CLV) | M (2 d) |
| 14 | Budget (trend, alerts, drill-down) | M (2 d) |
| 15 | Google Sheets (OAuth + scheduled sync) | M (2 d) |
| 16 | SharePoint (linked sync, streaming) | M (2 d) |
| 17 | Pipelines (reorder, join types, hash-join) | M (2 d) |
| 18 | Team (invite expiry, resend, bulk, audit) | S (1 d) |

---

## Cross-cutting upgrades worth threading through all cohorts

These aren't tools — they're patterns that every tool would benefit from. Easiest to add while rebuilding each one.

1. **Date range picker as a shared component.** Every tool that touches a date column should respect a global date filter at the page top. Build once, reuse everywhere.
2. **"Pin to dashboard" button** on every chart / KPI / insight — threads the product into a single workflow instead of standalone tools.
3. **"Open in Ask Your Data" button** on every insight / table / anomaly — lets users drill from any view into the chat.
4. **Export-anywhere pattern.** CSV / PNG / PDF export hook available on every chart, one shared util.
5. **Empty states.** Audit + Explore subagents both flagged inconsistent empty states. One styled component, plugged into every page.
6. **Loading skeletons** replacing the generic spinners.

---

## Recommended next step

Pick a cohort. My suggestion: **Cohort 1 (the P0s)** — it's the smallest coherent shippable unit that moves the product from "feels like a demo" to "feels like something an insight director would pay for". The rest can wait.

Tell me which items to build first (single cohort, a custom cherry-pick, or all P0+P1) and I'll start with the first one immediately.
