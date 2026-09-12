create index if not exists sos_hero_application_notifications_application_idx
  on public.sos_hero_application_notifications(application_id);

create index if not exists sos_recruiting_candidate_zone_coverage_zone_idx
  on public.sos_recruiting_candidate_zone_coverage(zone_id);

create index if not exists sos_recruiting_source_records_candidate_idx
  on public.sos_recruiting_source_records(candidate_id);
