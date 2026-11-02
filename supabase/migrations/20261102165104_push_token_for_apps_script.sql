-- Data now arrives from a Google Apps Script running under the sheet owner's account
-- (service-account key creation is blocked by org policy). The script authenticates to
-- the push-sheets function with a random token; only its SHA-256 hash is stored here.
create table if not exists public.push_token (
  id int primary key default 1 check (id = 1),
  token_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.push_token enable row level security;
revoke all on public.push_token from anon, authenticated;

-- Stop the 3-minute service-account pull job.
select cron.unschedule('sync-sheets');
