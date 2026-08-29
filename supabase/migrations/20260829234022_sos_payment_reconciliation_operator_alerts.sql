create table if not exists private.sos_payment_reconciliation_alert_state (
  payment_id uuid not null,
  reconciliation_issue text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_alerted_at timestamptz,
  last_alert_id uuid,
  resolved_at timestamptz,
  occurrences bigint not null default 1,
  primary key (payment_id, reconciliation_issue)
);

alter table private.sos_payment_reconciliation_alert_state enable row level security;
revoke all on table private.sos_payment_reconciliation_alert_state from public, anon, authenticated;
grant select, insert, update, delete on table private.sos_payment_reconciliation_alert_state to service_role;

create or replace function private.sos_sync_payment_reconciliation_alerts()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v record;
  v_state private.sos_payment_reconciliation_alert_state%rowtype;
  v_alert_id uuid;
  v_new_alerts integer := 0;
  v_resolved integer := 0;
  v_current integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('sos_payment_reconciliation_alert_sync', 0)) then
    return jsonb_build_object('status','skipped_overlap','current_issues',0,'new_alerts',0,'resolved',0);
  end if;

  for v in
    select *
    from public.sos_payment_reconciliation_watch
  loop
    v_current := v_current + 1;

    select *
      into v_state
      from private.sos_payment_reconciliation_alert_state s
     where s.payment_id = v.payment_id
       and s.reconciliation_issue = v.reconciliation_issue
     for update;

    if not found then
      insert into public.marketplace_operator_alerts(
        product_key, alert_type, entity_id, title, body, metadata
      ) values (
        'sos',
        'payment_reconciliation',
        v.payment_id,
        'S.O.S. payment reconciliation exception',
        left(coalesce(v.reconciliation_issue,'Unknown reconciliation issue') ||
          case when v.mission_id is not null then ' · mission ' || v.mission_id::text else '' end, 1000),
        jsonb_build_object(
          'payment_id', v.payment_id,
          'mission_id', v.mission_id,
          'issue', v.reconciliation_issue,
          'payment_status', v.payment_status,
          'escrow_status', v.escrow_status,
          'settlement_type', v.settlement_type,
          'amount', v.amount,
          'refund_amount', v.refund_amount,
          'mission_status', v.mission_status,
          'first_detected_at', now()
        )
      ) returning id into v_alert_id;

      insert into private.sos_payment_reconciliation_alert_state(
        payment_id, reconciliation_issue, first_seen_at, last_seen_at,
        last_alerted_at, last_alert_id, resolved_at, occurrences
      ) values (
        v.payment_id, v.reconciliation_issue, now(), now(),
        now(), v_alert_id, null, 1
      );
      v_new_alerts := v_new_alerts + 1;

    elsif v_state.resolved_at is not null then
      insert into public.marketplace_operator_alerts(
        product_key, alert_type, entity_id, title, body, metadata
      ) values (
        'sos',
        'payment_reconciliation',
        v.payment_id,
        'S.O.S. payment reconciliation exception reopened',
        left(coalesce(v.reconciliation_issue,'Unknown reconciliation issue') ||
          case when v.mission_id is not null then ' · mission ' || v.mission_id::text else '' end, 1000),
        jsonb_build_object(
          'payment_id', v.payment_id,
          'mission_id', v.mission_id,
          'issue', v.reconciliation_issue,
          'payment_status', v.payment_status,
          'escrow_status', v.escrow_status,
          'settlement_type', v.settlement_type,
          'amount', v.amount,
          'refund_amount', v.refund_amount,
          'mission_status', v.mission_status,
          'reopened_at', now()
        )
      ) returning id into v_alert_id;

      update private.sos_payment_reconciliation_alert_state
         set last_seen_at = now(),
             last_alerted_at = now(),
             last_alert_id = v_alert_id,
             resolved_at = null,
             occurrences = occurrences + 1
       where payment_id = v.payment_id
         and reconciliation_issue = v.reconciliation_issue;
      v_new_alerts := v_new_alerts + 1;

    else
      update private.sos_payment_reconciliation_alert_state
         set last_seen_at = now(),
             occurrences = occurrences + 1
       where payment_id = v.payment_id
         and reconciliation_issue = v.reconciliation_issue;
    end if;
  end loop;

  update private.sos_payment_reconciliation_alert_state s
     set resolved_at = now()
   where s.resolved_at is null
     and not exists (
       select 1
         from public.sos_payment_reconciliation_watch w
        where w.payment_id = s.payment_id
          and w.reconciliation_issue = s.reconciliation_issue
     );
  get diagnostics v_resolved = row_count;

  return jsonb_build_object(
    'status','ok',
    'current_issues',v_current,
    'new_alerts',v_new_alerts,
    'resolved',v_resolved
  );
end;
$$;

revoke all on function private.sos_sync_payment_reconciliation_alerts() from public, anon, authenticated;
grant execute on function private.sos_sync_payment_reconciliation_alerts() to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'sos-payment-reconciliation-alerts';

select cron.schedule(
  'sos-payment-reconciliation-alerts',
  '*/5 * * * *',
  'select private.sos_sync_payment_reconciliation_alerts();'
);
