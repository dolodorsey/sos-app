begin;
alter table public.sos_payments drop constraint if exists sos_payments_escrow_status_check;
alter table public.sos_payments add constraint sos_payments_escrow_status_check check (
  escrow_status in ('pending_authorization','authorized_hold','held_for_release','released_to_hero','released_to_customer','partially_refunded','refunded','failed','disputed')
);
commit;
