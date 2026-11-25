-- S.O.S. payments — found by the end-to-end rescue test on Nov 25, 2026.
-- 1) The shared cancellation-protection trigger read old.status (an ON CALL column) in the same
--    IF expression as the S.O.S. check. PL/pgSQL resolves every field in the expression, so ANY
--    update to sos_payments failed ("record old has no field status"): Hero accept, capture,
--    payout and refund would all have crashed on the first real paid rescue.
--    Each table now gets its own branch, so only that table's fields are read.
-- 2) sos_payments.escrow_status defaulted to 'held', which its own check constraint rejects.
create or replace function private.protect_terminal_cancellation_settlements()
 returns trigger
 language plpgsql
 set search_path to 'pg_catalog','public'
as $function$
begin
 if tg_table_name='sos_payments' then
   if old.settlement_type in ('customer_cancellation','customer_no_show') and old.payment_status='released' and new.payment_status='captured' then
     new.payment_status:=old.payment_status;
     new.escrow_status:=old.escrow_status;
     new.released_at:=old.released_at;
     new.stripe_transfer_id:=old.stripe_transfer_id;
   end if;
 elsif tg_table_name='oc_booking_payments' then
   if old.settlement_type in ('customer_cancellation','customer_no_show') and old.status='transferred' and new.status in ('captured','transfer_pending') then
     new.status:=old.status;
     new.transferred_at:=old.transferred_at;
     new.stripe_transfer_id:=old.stripe_transfer_id;
   end if;
 end if;
 return new;
end $function$;

alter table public.sos_payments alter column escrow_status set default 'pending_authorization';
