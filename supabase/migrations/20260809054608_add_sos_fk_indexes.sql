-- Cover production foreign keys used by Hero intake, mission tracking, chat, and support.
create index if not exists sos_hero_applications_candidate_id_idx
  on public.sos_hero_applications(candidate_id);

create index if not exists sos_hero_applications_source_hero_id_idx
  on public.sos_hero_applications(source_hero_id);

create index if not exists sos_hero_applications_source_user_id_idx
  on public.sos_hero_applications(source_user_id);

create index if not exists sos_mission_messages_sender_user_id_idx
  on public.sos_mission_messages(sender_user_id);

create index if not exists sos_mission_shares_v2_citizen_id_idx
  on public.sos_mission_shares_v2(citizen_id);

create index if not exists sos_support_tickets_mission_id_idx
  on public.sos_support_tickets(mission_id);
