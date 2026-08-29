-- Normalize S.O.S. refund state at the database boundary so webhook/order variance
-- cannot incorrectly mark a partial refund as fully refunded.

create or replace function private.sos_normalize_refund_state()
returns trigger
language plpgsql
set search_path = 'pg_catalog', 'public', 'private'
as $$
declare
  v_total numeric;
begin
  v_total := round(
    coalesce(new.amount, 0)
    + coalesce(new.tax, 0)
    + coalesce(new.tip, 0),
    2
  );

  if new.payment_status = 'refunded'
     and round(coalesce(new.refund_amount, 0), 2) > 0
     and round(coalesce(new.refund_amount, 0), 2) < v_total then
    new.payment_status := 'partially_refunded';
    new.escrow_status := 'partially_refunded';
    new.refunded_at := coalesce(new.refunded_at, now());
  end if;

  return new;
end;
$$;

revoke all on function private.sos_normalize_refund_state() from public;
grant execute on function private.sos_normalize_refund_state() to service_role;

drop trigger if exists sos_payments_normalize_refund_state on public.sos_payments;
create trigger sos_payments_normalize_refund_state
before insert or update of payment_status, refund_amount, amount, tax, tip
on public.sos_payments
for each row
execute function private.sos_normalize_refund_state();
