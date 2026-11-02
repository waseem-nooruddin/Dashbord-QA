-- Lets sync-sheets verify the cron job's x-sync-secret header against the Vault secret.
create or replace function public.sync_secret_matches(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'sync_secret' and decrypted_secret = candidate
  );
$$;
revoke execute on function public.sync_secret_matches(text) from public, anon, authenticated;
grant execute on function public.sync_secret_matches(text) to service_role;
