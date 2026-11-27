-- SHIQI — tabela/coluna/sequence ACL de referência.
-- Extraído de information_schema.role_table_grants e column_privileges
-- do Supabase original em 2026-11-26; exclui música e QR.
-- Hardened: nunca conceder acesso a anon. RLS continua obrigatória.
-- Aplicar somente depois de validar cada coluna contra CANONICAL_TABLES.sql.

-- Revoke grants amplos/defaults antes dos grants específicos.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

REVOKE ALL PRIVILEGES (id, username, display_name, birth_date, marketing_opt_in,
  created_at, bio, status_text, avatar_path, accent, last_seen,
  terms_accepted_at, plan, settings, presence, deactivated_at, profile_updated_at)
ON TABLE public.profiles FROM anon, authenticated;
REVOKE ALL PRIVILEGES (id, channel_id, author_id, content, created_at, edited_at,
  attachment_path, attachment_alt, thread_of)
ON TABLE public.messages FROM anon, authenticated;

-- Leitura direta permitida pelo original; todas as tabelas permanecem sob RLS.
GRANT SELECT ON public.blocks, public.channels, public.dm_members,
  public.event_interest, public.friendships, public.message_reactions,
  public.messages, public.server_events, public.server_members,
  public.server_pins, public.servers, public.voice_members
TO authenticated;

-- Mensagens: exclusão permitida por RLS (autor ou proprietário).
GRANT DELETE ON public.messages TO authenticated;

-- Perfil: leitura apenas dos campos públicos/de presença.
GRANT SELECT (id, username, display_name, avatar_path, deactivated_at,
  last_seen, presence, profile_updated_at)
ON public.profiles TO authenticated;

-- Perfil: escrita apenas dos campos editáveis/presença.
GRANT UPDATE (accent, avatar_path, bio, display_name, last_seen, status_text)
ON public.profiles TO authenticated;

-- Mensagens: inserção/edição limitada aos campos usados pelo cliente.
-- author_id não é concedido para INSERT; deve ser preenchido por default seguro.
GRANT INSERT (attachment_alt, attachment_path, channel_id, content, thread_of)
ON public.messages TO authenticated;
GRANT UPDATE (content) ON public.messages TO authenticated;

-- Identity sequence: apenas USAGE necessário para geração automática do id.
GRANT USAGE ON SEQUENCE public.messages_id_seq TO authenticated;

-- service_role recebe privilégios administrativos sobre tabelas e sequences
-- através do modelo Supabase padrão; não conceder anon.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Tabelas internas sem grants diretos a authenticated:
-- email_codes, rate_hits, server_invites, server_bans, mfa_recovery.
-- Escritas/leituras dessas áreas permanecem mediadas por RPCs/Edge Function.
