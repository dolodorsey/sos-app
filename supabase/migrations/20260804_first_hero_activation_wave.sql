-- Controlled recruiting wave only. No candidate becomes a Hero or enters live coverage.

with ranked as (
  select c.id,c.target_zone,
         row_number() over(
           partition by c.target_zone
           order by c.priority_score desc,c.source_review_count desc nulls last,c.id
         ) rn
  from public.sos_recruiting_candidates c
  where c.target_zone is not null
), first_wave as (
  select id from ranked where rn<=20
), sequenced as (
  select c.id,row_number() over(order by c.priority_score desc,c.id) seq
  from public.sos_recruiting_candidates c
  join first_wave f on f.id=c.id
)
update public.sos_recruiting_candidates c
set pipeline_stage='qualified',
    outreach_status='queued',
    next_action_at=now()+(s.seq-1)*interval '12 minutes',
    notes=concat_ws(E'\n',nullif(c.notes,''),
      'First Hero activation wave: verification, training, authenticated account, test mission and live GPS shift still required.'),
    updated_at=now()
from sequenced s
where c.id=s.id and c.pipeline_stage='prospect';

create or replace view public.sos_first_wave_summary
with (security_invoker=true)
as
select target_zone,
       count(*)::integer candidates,
       count(*) filter(where outreach_status='queued')::integer queued,
       round(avg(priority_score),2) average_priority,
       min(next_action_at) next_action_at
from public.sos_recruiting_candidates
where pipeline_stage='qualified'
group by target_zone;

revoke all on public.sos_first_wave_summary from public,anon,authenticated;
