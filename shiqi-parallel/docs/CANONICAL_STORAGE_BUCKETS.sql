-- SHIQI — configuração canônica dos buckets Storage.
-- Referência para a migration revisada; NÃO executar isoladamente.
-- Requer Storage habilitado no projeto e deve ser aplicada após o preflight.
-- Não sobrescreve buckets existentes: falha se encontrar configuração divergente.

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'avatars', 'avatars', true, 1048576,
      ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'avatars'
      AND name = 'avatars'
      AND public IS TRUE
      AND file_size_limit = 1048576
      AND allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
      AND allowed_mime_types <@ ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
  ) THEN
    RAISE EXCEPTION 'SHIQI: bucket avatars existe com configuração divergente';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'attachments') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'attachments', 'attachments', false, 3145728,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'attachments'
      AND name = 'attachments'
      AND public IS FALSE
      AND file_size_limit = 3145728
      AND allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
      AND allowed_mime_types <@ ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  ) THEN
    RAISE EXCEPTION 'SHIQI: bucket attachments existe com configuração divergente';
  END IF;
END
$migration$;
