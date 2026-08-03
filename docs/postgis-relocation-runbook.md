# SOS PostGIS Relocation Runbook

## Status

Support intervention required. Do not run the support migration from the SQL editor, CLI migration runner, CI, or an application connection.

## Why normal migrations cannot fix the advisory

PostGIS is installed in `public`, and the extension-owned `spatial_ref_sys` table belongs to `supabase_admin`. Project migrations execute as `postgres`, so they cannot safely enable RLS or relocate the table. Changing ownership or dropping PostGIS in production would put dispatch and distance calculations at risk.

## Controlled resolution

Ask Supabase Support to execute:

`supabase/support-migrations/20260803_relocate_postgis_from_public.sql`

The script:

1. Requires `current_user = supabase_admin`.
2. Runs inside one transaction.
3. Uses the PostGIS upgrade bridge to move the extension from `public` to `extensions`.
4. Restores the extension to non-relocatable state.
5. Recreates `public.sos_find_nearby_heroes` with `extensions.st_*` calls.
6. Validates coordinate transforms and the nearby-Hero query.
7. Rolls back automatically if any step fails.

## Preflight

- Create a backup or point-in-time recovery checkpoint.
- Record the current PostGIS version and schema.
- Confirm `${CURRENT_POSTGIS_VERSION}next` exists for the project.
- Confirm the production SOS route and one rollback candidate are healthy.
- Pause operator dispatch during the maintenance window.
- Record the current function definition:

```sql
select pg_get_functiondef('public.sos_find_nearby_heroes(double precision,double precision,double precision,text)'::regprocedure);
```

## Validation

```sql
select extversion, extnamespace::regnamespace::text
from pg_extension
where extname='postgis';
```

Expected schema: `extensions`.

```sql
select extensions.st_astext(
  extensions.st_transform(
    extensions.st_setsrid(extensions.st_makepoint(-84.388, 33.749), 4326),
    3857
  )
);
```

```sql
select *
from public.sos_find_nearby_heroes(33.749, -84.388, 15, null)
limit 5;
```

Then verify customer request intake, Hero GPS heartbeat, operator offer dispatch, Hero acceptance, and mission transitions.

## Rollback

Before commit, any failure restores the original extension and function. After a successful commit, moving PostGIS back to `public` also requires Supabase Support and the extension owner. Do not drop/recreate PostGIS on the production project as an emergency rollback.
