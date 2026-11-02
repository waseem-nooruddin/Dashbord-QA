-- QA LiveSync schema: connected projects, sync snapshots, approved viewers, 3-minute sync job.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  spreadsheet_id text not null,
  tab text not null default 'QA Metrics Severity Priority Report',
  range text not null default 'A1:X200',
  enabled boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

-- One row per distinct read of a source tab. Raw cell values are kept so every figure
-- stays traceable to source cells (NFR-08); the UI maps columns by position.
-- An unchanged read only bumps checked_at on the latest ok snapshot.
create table public.snapshots (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  synced_at timestamptz not null default now(),
  checked_at timestamptz not null default now(),
  status text not null check (status in ('ok', 'failed')),
  "values" jsonb,
  error text
);
create index snapshots_project_synced_idx on public.snapshots (project_id, synced_at desc);

-- Approved viewers: either a full email or a whole domain.
create table public.allowed_users (
  id bigint generated always as identity primary key,
  email text unique,
  domain text unique,
  created_at timestamptz not null default now(),
  check ((email is null) <> (domain is null))
);

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_users a
    where a.email = lower(auth.jwt() ->> 'email')
       or a.domain = split_part(lower(auth.jwt() ->> 'email'), '@', 2)
  );
$$;
revoke execute on function public.is_approved() from public, anon;
grant execute on function public.is_approved() to authenticated;

alter table public.projects enable row level security;
alter table public.snapshots enable row level security;
alter table public.allowed_users enable row level security;

create policy "approved users read projects" on public.projects
  for select to authenticated using ((select public.is_approved()));
create policy "approved users read snapshots" on public.snapshots
  for select to authenticated using ((select public.is_approved()));
-- allowed_users has no policies: only the service role can read or change it.

-- Scheduled sync (FR-04). Needs vault secrets 'project_url' and 'sync_secret';
-- see README "Scheduled sync".
create extension if not exists pg_cron;
create extension if not exists pg_net schema extensions;

select cron.schedule(
  'sync-sheets',
  '*/3 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sync-sheets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'prune-failed-snapshots',
  '0 3 * * *',
  $$ delete from public.snapshots where status = 'failed' and synced_at < now() - interval '7 days' $$
);
