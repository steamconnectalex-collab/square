-- Simula duas identidades JWT sobre uma conta Auth real existente.
-- Valida RLS de profiles sem criar usuários ou persistir alterações.
-- Executar no SQL Editor do projeto paralelo; termina com ROLLBACK.

BEGIN;

CREATE TEMP TABLE shiqi_rls_probe_ids (
  owner_id uuid NOT NULL,
  other_id uuid NOT NULL
);
INSERT INTO shiqi_rls_probe_ids(owner_id, other_id)
SELECT id, gen_random_uuid()
FROM auth.users
ORDER BY created_at
LIMIT 1;

CREATE TEMP TABLE shiqi_rls_probe_results (
  identity_label text NOT NULL,
  jwt_uid text,
  aal text,
  can_read_owner_profile integer NOT NULL,
  owner_update_rows integer NOT NULL
);

GRANT SELECT ON shiqi_rls_probe_ids TO authenticated;
GRANT INSERT ON shiqi_rls_probe_results TO authenticated;

SET LOCAL ROLE authenticated;

-- Identidade A: conta Auth real já existente.
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT owner_id::text FROM shiqi_rls_probe_ids),
  true
);
SELECT set_config(
  'request.jwt.claims',
  (SELECT jsonb_build_object(
    'sub', owner_id::text,
    'role', 'authenticated',
    'aal', 'aal1'
  )::text FROM shiqi_rls_probe_ids),
  true
);
INSERT INTO shiqi_rls_probe_results
SELECT
  'owner',
  auth.uid()::text,
  auth.jwt()->>'aal',
  (SELECT count(*)::int FROM public.profiles p WHERE p.id = ids.owner_id),
  (WITH changed AS (
    UPDATE public.profiles
    SET bio = coalesce(bio, '')
    WHERE id = ids.owner_id
    RETURNING 1
  ) SELECT count(*)::int FROM changed)
FROM shiqi_rls_probe_ids ids;

-- Identidade B: UUID sintético, sem criar linha em auth.users.
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT other_id::text FROM shiqi_rls_probe_ids),
  true
);
SELECT set_config(
  'request.jwt.claims',
  (SELECT jsonb_build_object(
    'sub', other_id::text,
    'role', 'authenticated',
    'aal', 'aal1'
  )::text FROM shiqi_rls_probe_ids),
  true
);
INSERT INTO shiqi_rls_probe_results
SELECT
  'synthetic_other',
  auth.uid()::text,
  auth.jwt()->>'aal',
  (SELECT count(*)::int FROM public.profiles p WHERE p.id = ids.owner_id),
  (WITH changed AS (
    UPDATE public.profiles
    SET bio = coalesce(bio, '')
    WHERE id = ids.owner_id
    RETURNING 1
  ) SELECT count(*)::int FROM changed)
FROM shiqi_rls_probe_ids ids;

RESET ROLE;

DO $$
DECLARE
  owner_read integer;
  owner_update integer;
  other_read integer;
  other_update integer;
BEGIN
  SELECT can_read_owner_profile, owner_update_rows
    INTO owner_read, owner_update
  FROM pg_temp.shiqi_rls_probe_results
  WHERE identity_label = 'owner';

  SELECT can_read_owner_profile, owner_update_rows
    INTO other_read, other_update
  FROM pg_temp.shiqi_rls_probe_results
  WHERE identity_label = 'synthetic_other';

  IF owner_read IS DISTINCT FROM 1 OR owner_update IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'RLS owner check failed: read %, update %', owner_read, owner_update;
  END IF;
  IF other_read IS DISTINCT FROM 0 OR other_update IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'RLS isolation check failed: other read %, update %', other_read, other_update;
  END IF;
END $$;

SELECT * FROM shiqi_rls_probe_results ORDER BY identity_label;

ROLLBACK;
