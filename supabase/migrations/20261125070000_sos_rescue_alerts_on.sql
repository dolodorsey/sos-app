-- S.O.S. rescue alerts back on (Nov 25, 2026, Dolo: "finish fixing app and testing").
-- The push worker reads this switch; set enabled=false to stop every S.O.S. push alert.
-- ON CALL push stays under the Oct 7, 2026 founder stop (its trigger stays disabled).
insert into public.sos_system_config(config_key,config_value,description,category,is_active,updated_by)
values ('rescue_alerts', jsonb_build_object('enabled',true,'turned_on','2026-11-25'),
 'On/off switch for S.O.S. rescue alerts to Hero and customer phones. Set enabled to false to stop all S.O.S. push alerts. ON CALL push stays paused.','operations',true,'Duet')
on conflict (config_key) do update set is_active=true, updated_at=now();

alter table public.sos_notifications enable trigger sos_notification_push_kick;
alter table public.oc_notifications disable trigger oc_notification_push_kick;

-- Backup sweep every minute: rescue offers expire fast, so a 5-minute fallback is too slow.
select cron.alter_job(job_id := (select jobid from cron.job where jobname='marketplace-push-delivery'), schedule := '* * * * *', active := true);
