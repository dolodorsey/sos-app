-- Allow 'selfie' as a Hero application document type.
-- 20261120090000 made the upload RPC accept 'selfie', but the documents table
-- check constraint still rejected it. Additive: widens the allowed list only.
alter table public.sos_hero_application_documents
  drop constraint if exists sos_hero_application_documents_document_type_check;
alter table public.sos_hero_application_documents
  add constraint sos_hero_application_documents_document_type_check
  check (document_type = any (array['government_id','drivers_license','selfie','insurance','vehicle_registration','business_license','certification','vehicle_photo','equipment_photo','other']::text[]));
