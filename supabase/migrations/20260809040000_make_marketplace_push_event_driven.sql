-- Shared SOS / ON CALL infrastructure: kick background push immediately when a push notification is inserted.
-- The existing once-per-minute pg_cron worker remains the retry/fallback path.
create or replace function private.marketplace_kick_push_delivery()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','net','vault','private'
as $$
declare
  v_url text;
  v_token text;
begin
  if coalesce(new.channel,'push') <> 'push' then return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name='marketplace_project_url' limit 1;
  select decrypted_secret into v_token from vault.decrypted_secrets where name='marketplace_push_worker_token' limit 1;
  if nullif(v_url,'') is not null and nullif(v_token,'') is not null then
    perform net.http_post(
      url := rtrim(v_url,'/') || '/functions/v1/marketplace-push-delivery',
      headers := jsonb_build_object('Content-Type','application/json','x-worker-token',v_token),
      body := jsonb_build_object('source','notification_trigger','notification_id',new.id,'requested_at',now()),
      timeout_milliseconds := 5000
    );
  end if;
  return new;
exception when others then
  raise warning 'marketplace push kick failed for notification %: %',new.id,sqlerrm;
  return new;
end;
$$;

drop trigger if exists oc_notification_push_kick on public.oc_notifications;
create trigger oc_notification_push_kick
after insert on public.oc_notifications
for each row when (new.channel='push')
execute function private.marketplace_kick_push_delivery();

drop trigger if exists sos_notification_push_kick on public.sos_notifications;
create trigger sos_notification_push_kick
after insert on public.sos_notifications
for each row when (new.channel='push')
execute function private.marketplace_kick_push_delivery();

revoke all on function private.marketplace_kick_push_delivery() from public,anon,authenticated;
