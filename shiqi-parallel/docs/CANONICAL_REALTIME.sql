-- SHIQI — publicação Realtime canônica.
-- Referência para a migration revisada; NÃO executar isoladamente.
-- Executar somente depois de criar as tabelas canônicas e renomear o protótipo.
-- A tabela antiga messages passa a legacy_messages; removê-la da publicação
-- antes de adicionar a nova public.messages.

DO $migration$
DECLARE
  target_table text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'SHIQI: publicação supabase_realtime não existe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'legacy_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.legacy_messages';
  END IF;

  FOREACH target_table IN ARRAY ARRAY['friendships', 'messages', 'voice_members'] LOOP
    IF to_regclass('public.' || target_table) IS NULL THEN
      RAISE EXCEPTION 'SHIQI: tabela Realtime public.% ainda não existe', target_table;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = target_table
    ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        target_table
      );
    END IF;
  END LOOP;
END
$migration$;

-- Sinalização WebRTC em canal privado: somente membros atuais do servidor
-- dono do canal voice podem ler e publicar mensagens de broadcast.
DROP POLICY IF EXISTS voice_topic_select ON realtime.messages;
DROP POLICY IF EXISTS voice_topic_insert ON realtime.messages;
CREATE POLICY voice_topic_select ON realtime.messages
  FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND private.can_voice_topic((SELECT realtime.topic())));
CREATE POLICY voice_topic_insert ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (extension = 'broadcast' AND private.can_voice_topic((SELECT realtime.topic())));
