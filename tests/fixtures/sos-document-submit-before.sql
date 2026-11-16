CREATE OR REPLACE FUNCTION public.sos_hero_submit_application_document(p_application_id uuid, p_document_type text, p_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'storage'
AS $function$
declare a public.sos_hero_applications%rowtype; required_count int; final_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into a from public.sos_hero_applications where id=p_application_id and source_auth_id=auth.uid() for update;
  if not found then raise exception 'Bound Hero application required' using errcode='42501'; end if;
  if p_document_type not in ('government_id','drivers_license','insurance','vehicle_registration','business_license','certification','vehicle_photo','equipment_photo','other') then raise exception 'Unsupported document type'; end if;
  if p_path is null or p_path not like 'applications/'||auth.uid()::text||'/'||a.id::text||'/'||p_document_type||'/%' or position('..' in p_path)>0 then raise exception 'Invalid application document path'; end if;
  if not exists(select 1 from storage.objects where bucket_id='marketplace-verification' and name=p_path) then raise exception 'Uploaded credential file not found'; end if;
  insert into public.sos_hero_application_documents(application_id,auth_id,document_type,storage_path) values(a.id,auth.uid(),p_document_type,p_path) on conflict(storage_path) do nothing;
  select count(distinct document_type) into required_count from public.sos_hero_application_documents where application_id=a.id and status<>'rejected' and document_type in ('government_id','drivers_license','insurance');
  final_status:=case when required_count=3 then 'waitlisted' else 'documents_required' end;
  update public.sos_hero_applications set status=case when status in ('documents_required','waitlisted') then final_status else status end,credentials_complete_at=case when required_count=3 then coalesce(credentials_complete_at,now()) else null end,updated_at=now() where id=a.id;
  return jsonb_build_object('application_id',a.id,'document_type',p_document_type,'required_uploaded',required_count,'required_total',3,'status',final_status);
end $function$
;

