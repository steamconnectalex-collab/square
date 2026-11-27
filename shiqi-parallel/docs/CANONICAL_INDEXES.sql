-- SHIQI — índices canônicos extraídos do catálogo PostgreSQL original.
-- Referência de reconstrução; PK indexes já são criados pelas constraints em CANONICAL_TABLES.sql.
-- Não executar este arquivo isoladamente antes das tabelas.

create index channels_server_idx on public.channels using btree (server_id, "position");
create index dm_members_user_idx on public.dm_members using btree (user_id);
create index email_codes_expires_idx on public.email_codes using btree (expires_at);
create index email_codes_lookup_idx on public.email_codes using btree (email, purpose, created_at desc);
create index friendships_b_idx on public.friendships using btree (user_b);
create index message_reactions_msg_idx on public.message_reactions using btree (message_id);
create index messages_author_created_idx on public.messages using btree (author_id, created_at desc);
create index messages_author_idx on public.messages using btree (author_id);
create index messages_channel_created_idx on public.messages using btree (channel_id, created_at desc);
create index messages_thread_idx on public.messages using btree (thread_of) where thread_of is not null;
create unique index profiles_username_lower_key on public.profiles using btree (lower(username));
create index rate_hits_key_at_idx on public.rate_hits using btree (key, at desc);
create index server_events_srv_idx on public.server_events using btree (server_id, starts_at);
create index server_invites_creator_idx on public.server_invites using btree (created_by);
create index server_invites_server_idx on public.server_invites using btree (server_id);
create index server_members_user_idx on public.server_members using btree (user_id);
create index servers_owner_idx on public.servers using btree (owner_id);
create index voice_members_user_idx on public.voice_members using btree (user_id);
