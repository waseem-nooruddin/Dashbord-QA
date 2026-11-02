# QA LiveSync

Live QA reporting dashboard for EDCS, DIE and DIE Data Sharing. It reads each project's
**QA Metrics Severity Priority Report** tab (A1:X200) from Google Sheets, recalculates every
total, ratio and the Defect Severity Index, and shows KPIs, eight charts, a detailed table and
Excel/CSV/PDF exports. Built from *QA LiveSync — SRS v1.0*, with Supabase in place of Firebase.

**Live app:** https://waseem-nooruddin.github.io/Dashbord-QA/

## Architecture

```
Google Sheets ── Apps Script (owner's account, time trigger) ──▶ Edge Function push-sheets ──▶ snapshots table
                                                                                                │ RLS: approved users only
                                                                                                ▼
                         GitHub Pages (React) ── adapter → calculation layer → KPIs, charts, table, exports
```

| SRS (Firebase) | This build |
| --- | --- |
| Cloud Function, scheduled | Google Apps Script time trigger → Edge Function `push-sheets` (FR-04) |
| Firestore snapshots | `snapshots` table: raw cell values per sync; unchanged reads only bump `checked_at` (FR-08) |
| Firebase Auth | Supabase Auth with Google + `allowed_users` table + RLS (FR-54) |
| Firebase Hosting | GitHub Pages, deployed by `.github/workflows/deploy.yml` |

| Path | What it is |
| --- | --- |
| `src/lib/adapter.ts` | Maps columns A–X by position (SRS 5.1) |
| `src/lib/calc.ts` | The single calculation layer: grouping, totals, ratios, DSI, validation |
| `src/lib/formulas.ts` | Formulas and DSI weights, also shown on the page |
| `src/lib/charts.ts` | Chart 1–8 options |
| `src/lib/table.ts`, `src/lib/export.ts` | Detailed table model; Excel, CSV (formula-safe), PDF |
| `supabase/migrations/` | Schema, RLS, cron job |
| `supabase/functions/push-sheets/` | Receives values from the Apps Script (active) |
| `supabase/functions/sync-sheets/` | Service-account pull (retired: key creation is blocked by org policy) |

## One-time setup (owner)

Supabase project: `qa-livesync` (`bhazbqurcjlvngqutudr`, region ap-south-1). Schema, functions,
the three projects and today's data are already in place.

### 1. Data feed (Google Apps Script) — done

An Apps Script under the sheet owner's Google account reads each project's tab and POSTs it to
`https://bhazbqurcjlvngqutudr.supabase.co/functions/v1/push-sheets`:

- `register` — claims the push token (only its SHA-256 hash is stored in `push_token`).
- `config` — returns the enabled projects (workbook ID, tab, range), so new projects need no script change.
- `push` — `{ results: [{ project_id, values } | { project_id, error }] }`; unchanged values only bump `checked_at`.

The dashboard shows **Failed · showing last data** if the script reports an error or has not
checked in for 15 minutes. Sync Now re-reads the latest pushed data. To rotate the token:
`delete from public.push_token;` then run the script's register step again.

### 2. Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web).
   Authorised redirect URI: `https://bhazbqurcjlvngqutudr.supabase.co/auth/v1/callback`.
2. Supabase Dashboard → Authentication → Sign In / Providers → Google: paste client ID and secret, enable.
3. Authentication → URL Configuration: Site URL `https://waseem-nooruddin.github.io/Dashbord-QA/`,
   and add the same URL plus `http://localhost:5173/` to Redirect URLs.

### 3. Approve viewers

```sql
insert into public.allowed_users (email) values ('person@example.com');
insert into public.allowed_users (domain) values ('yourcompany.com');  -- a whole domain
```

### Adding a project (NFR-11)

```sql
insert into public.projects (name, spreadsheet_id, sort) values ('New Project', '<workbook id>', 3);
```
The Apps Script owner must be able to open the workbook. No code change is needed.

## Development

```bash
npm install
cp .env.example .env.local
npm run dev                 # needs Google sign-in configured
VITE_DEMO=1 npm run dev     # no login; uses tests/fixtures/local/*.json if present, else synthetic data
npm test                    # calculation layer (Vitest)
npm run e2e                 # Playwright, desktop + phone, synthetic data
```

Real sheet data is never committed (the repo is public): put a local export in
`tests/fixtures/local/` (git-ignored) to run the live-data checks.

## Notes

- Ratios use aggregated counts over modules that have test cases: Test Pass Ratio = Passed ÷ Total TC.
  This deliberately differs from some sheet ratio columns (for example HRMS - Payroll: 72 ÷ 389 = 18.5%).
- Status totals at the end of chart 3 bars are Passed + Failed + Blocked + Not Tested; the tooltip
  and ⚠ flag show the difference against Total TC.
- FR-17 (Google Picker to add projects) is still planned; the button explains the SQL route.
