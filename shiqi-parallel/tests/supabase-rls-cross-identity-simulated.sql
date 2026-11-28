-- Simula duas identidades JWT sobre uma conta Auth real existente.
-- Valida RLS de profiles sem criar usuários nem persistir alterações.
-- Executar no SQL Editor do projeto paralelo; termina com ROLLBACK.

BEGIN;

-- Captura uma conta real antes de assumir a role authenticated.
SELECT set_config(
  'shiqi.probe.owner',
  (SELECT id::text FROM auth.users ORDER BY created_at LIMIT 1),
  true
);
SELECT set_config('shiqi.probe.other', '11111111-1111-4111-8111-111111111111', true);

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  owner_id uuid := current_setting('shiqi.probe.owner')::uuid;
  other_id uuid := current_setting('shiqi.probe.other')::uuid;
  owner_read integer;
  owner_update integer;
  other_read integer;
  other_update integer;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'RLS probe requires one existing Auth user';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', owner_id::text, 'role', 'authenticated', 'aal', 'aal1'
  )::text, true);

  SELECT count(*)::int INTO owner_read
  FROM public.profiles WHERE id = owner_id;

  UPDATE public.profiles
  SET bio = '__shiqi_rls_probe__'
  WHERE id = owner_id;
  GET DIAGNOSTICS owner_update = ROW_COUNT;

  PERFORM set_config('request.jwt.claim.sub', other_id::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', other_id::text, 'role', 'authenticated', 'aal', 'aal1'
  )::text, true);

  SELECT count(*)::int INTO other_read
  FROM public.profiles WHERE id = owner_id;

  UPDATE public.profiles
  SET bio = '__shiqi_rls_probe__'
  WHERE id = owner_id;
  GET DIAGNOSTICS other_update = ROW_COUNT;

  PERFORM set_config('shiqi.probe.owner_read', owner_read::text, true);
  PERFORM set_config('shiqi.probe.owner_update', owner_update::text, true);
  PERFORM set_config('shiqi.probe.other_read', other_read::text, true);
  PERFORM set_config('shiqi.probe.other_update', other_update::text, true);

  IF owner_read <> 1 OR owner_update <> 1 THEN
    RAISE EXCEPTION 'RLS owner check failed: read %, update %', owner_read, owner_update;
  END IF;
  IF other_read <> 0 OR other_update <> 0 THEN
    RAISE EXCEPTION 'RLS isolation check failed: other read %, update %', other_read, other_update;
  END IF;
END $$;

RESET ROLE;

SELECT json_build_object(
  'owner_can_read_own_profile', current_setting('shiqi.probe.owner_read')::int = 1,
  'owner_can_update_own_profile', current_setting('shiqi.probe.owner_update')::int = 1,
  'synthetic_other_cannot_read_profile', current_setting('shiqi.probe.other_read')::int = 0,
  'synthetic_other_cannot_update_profile', current_setting('shiqi.probe.other_update')::int = 0
) AS simulated_rls_result;

ROLLBACK;
