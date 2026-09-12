create index if not exists sos_crm_outbox_user_idx
  on public.sos_crm_outbox(user_id);

alter policy hero_application_notifications_select
  on public.sos_hero_application_notifications
  using ((select auth.uid()) = auth_id);
