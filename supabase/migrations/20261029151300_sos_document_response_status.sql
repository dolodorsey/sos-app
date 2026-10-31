-- Return the actual persisted lifecycle status; preserve authorization and transitions.
-- Reviewed against the production definition on 2026-10-29. Fail closed on drift.
DO $repair$
DECLARE source text;
BEGIN
  source := pg_get_functiondef('public.sos_hero_submit_application_document(uuid,text,text)'::regprocedure);
  IF md5(source) <> '1520276e56bd1e641d005d0fb47ec640' THEN
    RAISE EXCEPTION 'SOS document registration definition changed; review before applying';
  END IF;
  EXECUTE replace(source,
    'updated_at=now() where id=a.id;',
    'updated_at=now() where id=a.id returning status into final_status;');
END
$repair$;
