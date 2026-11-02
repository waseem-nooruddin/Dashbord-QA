# QA LiveSync

Live QA reporting dashboard for EDCS, DIE and DIE Data Sharing. It reads each project's
**QA Metrics Severity Priority Report** tab (A1:X200) from Google Sheets, recalculates every
total, ratio and the Defect Severity Index, and shows KPIs, eight charts, a detailed table and
Excel/CSV/PDF exports. Built from *QA LiveSync — SRS v1.0*, with Supabase in place of Firebase.

**Live app:** https://waseem-nooruddin.github.io/Dashbord-QA/

## Architecture

```
Google Sheets ──(service account, read-only)──▶ Edge Function sync-sheets ──▶ snapshots table
       ▲ every 3 min: pg_cron + pg_net              ▲ Sync Now (approved user)        │ RLS: approved users only
                                                                                     ▼
                         GitHub Pages (React) ── adapter → calculation layer → KPIs, charts, table, exports
```

| SRS (Firebase) | This build |
| --- | --- |
| Cloud Function, scheduled | Edge Function `sync-sheets`, `pg_cron` every 3 min (FR-04) |
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
| `supabase/functions/sync-sheets/` | Sheets → snapshot sync |

## One-time setup (owner)

Supabase project: `qa-livesync` (`bhazbqurcjlvngqutudr`, region ap-south-1). Schema, function,
cron job, the three projects and today's data are already in place.

### 1. Google service account (enables sync)

1. In Google Cloud Console create a project (or reuse one), enable **Google Sheets API**.
2. IAM & Admin → Service Accounts → create `qa-livesync-sync`; Keys → Add key → JSON.
3. Share each workbook (EDCS-, DIE-, Data sharing DIE-QA Metrics Report) with the service
   account's email as **Viewer**.
4. Supabase Dashboard → Edge Functions → Secrets → add `GOOGLE_SERVICE_ACCOUNT_JSON` with the
   whole JSON key file as the value.

Until this is done, Sync Now reports "GOOGLE_SERVICE_ACCOUNT_JSON secret is not set" and the
dashboard keeps showing the stored data.

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
Share the workbook with the service account. No code change is needed.

### Scheduled sync

The cron job `sync-sheets` posts to the function every 3 minutes with the Vault secret
`sync_secret`; the function checks it with `public.sync_secret_matches()`. Vault also holds
`project_url`. For a fresh project, create both:

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'sync_secret');
```

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
