-- Pending, not applied. Refuse to overwrite a changed anonymization function.
DO $repair$
DECLARE current_definition text; patched_definition text;
BEGIN
  current_definition := pg_get_functiondef('public.sos_anonymize_account(uuid)'::regprocedure);
  IF md5(btrim(current_definition, E' \n\r\t')) <> '05dd388a5117d32dcffa0e2df3ab7fea' THEN
    RAISE EXCEPTION 'SOS anonymization source changed; review before applying';
  END IF;
  patched_definition := replace(current_definition, 'description='''',status=''closed''', 'description=''Account deleted.'',status=''closed''');
  IF patched_definition = current_definition THEN
    RAISE EXCEPTION 'SOS support description target missing';
  END IF;
  EXECUTE patched_definition;
END;
$repair$;
