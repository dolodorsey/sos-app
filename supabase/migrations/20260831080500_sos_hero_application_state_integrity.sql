-- S.O.S. only: align active-application uniqueness with the canonical Hero application state machine.
-- The previous partial unique index referenced the retired `submitted` state and omitted current active states.

DROP INDEX IF EXISTS public.sos_hero_applications_open_email_uq;

CREATE UNIQUE INDEX sos_hero_applications_open_email_uq
ON public.sos_hero_applications (lower(email))
WHERE status IN (
  'documents_required',
  'waitlisted',
  'reviewing',
  'needs_information',
  'conditionally_approved',
  'approved'
);

COMMENT ON INDEX public.sos_hero_applications_open_email_uq IS
'Allows at most one active canonical S.O.S. Hero application per normalized email across every non-closed application state. Rejected and withdrawn applications remain eligible for a later reapplication.';
