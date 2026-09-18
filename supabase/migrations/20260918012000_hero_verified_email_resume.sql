create or replace function public.sos_hero_resume_application()
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $fn$
declare
  uid uuid:=auth.uid();
  em text:=lower(coalesce(auth.jwt()->>'email',''));
  a public.sos_hero_applications%rowtype;
  active_statuses text[]:=array['documents_required','waitlisted','reviewing','needs_information','conditionally_approved','approved'];
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if em='' then raise exception 'Verified account email required' using errcode='42501'; end if;

  select * into a
  from public.sos_hero_applications
  where lower(email)=em and status=any(active_statuses)
  order by submitted_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('found',false,'message','No active Hero application was found for this verified email.');
  end if;

  if a.source_auth_id is not null and a.source_auth_id<>uid then
    raise exception 'This application is already secured by another account' using errcode='42501';
  end if;

  if a.source_auth_id is null then
    update public.sos_hero_applications set source_auth_id=uid,updated_at=now() where id=a.id;
  end if;

  return jsonb_build_object(
    'found',true,'application_id',a.id,'email',a.email,'status',a.status,'submitted_at',a.submitted_at,'bound',true,
    'next_action',case
      when a.status='documents_required' then 'Upload the three required credentials.'
      when a.status='needs_information' then 'Review the application update and provide the requested information.'
      when a.status='waitlisted' then 'Your required credentials are received. S.O.S. operations review is next.'
      when a.status='reviewing' then 'S.O.S. operations is reviewing your application.'
      when a.status='conditionally_approved' then 'Complete final Hero onboarding before activation.'
      when a.status='approved' then 'Continue to Hero activation.'
      else 'Continue your Hero onboarding.'
    end
  );
end;
$fn$;

revoke all on function public.sos_hero_resume_application() from public,anon;
grant execute on function public.sos_hero_resume_application() to authenticated;
