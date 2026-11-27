-- SHIQI function ACL policy reference, based on has_function_privilege() in original.
-- This is a hardened target policy, not a byte-for-byte copy of permissive defaults.
-- All SECURITY DEFINER functions must retain SET search_path = '' and schema-qualify references.
-- Revoke PUBLIC/anon explicitly; then grant only the roles listed below.
-- Explicitly clear inherited/default API execution before granting the allow-list.
REVOKE USAGE ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.ban_member(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.change_username(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_channel(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_event(uuid,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_invite(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_server(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.delete_event(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.featured_servers() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_my_settings() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_server_member(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.join_public_server(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.join_server(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.kick_member(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.list_bans(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.list_public_servers() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.my_age_group() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.my_plan() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.open_dm(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pin_server(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.profiles_full(uuid[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.reactivate_account() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.remove_friend(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.respond_dm_request(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.respond_friend_request(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.save_my_settings(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.send_friend_request(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.send_friend_request(text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_my_presence(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_server_public(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.toggle_event_interest(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.toggle_reaction(bigint,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unban_member(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unblock_user(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unsubscribe_marketing() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.voice_join(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.voice_leave() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.voice_ping(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.voice_set_state(boolean,boolean,boolean,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_auth_user_by_email(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_login_email_by_username(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.purge_user_data(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rate_check(text,integer,integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.verify_email_code(text,text,text,integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.can_post(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.can_voice_topic(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.is_channel_member(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.is_channel_owner(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.is_dm_member(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.can_read_attachment(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.shares_server_with(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.accept_on_reply() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.check_thread_parent() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.dm_allowed(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.messages_rate_limit() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.remove_from_server(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.touch_edited_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.touch_profile() FROM PUBLIC, anon, authenticated, service_role;


-- Client-callable public RPCs: EXECUTE for authenticated and service_role.
GRANT EXECUTE ON FUNCTION public.ban_member(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_username(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_channel(uuid,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_event(uuid,text,text,text,timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_invite(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_server(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_event(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.featured_servers() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_server_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_public_server(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_server(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kick_member(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_bans(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_public_servers() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_age_group() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_plan() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.open_dm(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pin_server(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.profiles_full(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_account() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_friend(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_dm_request(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_my_settings(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_friend_request(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_friend_request(text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_my_presence(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_server_public(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_event_interest(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_reaction(bigint,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unban_member(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unsubscribe_marketing() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.voice_join(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.voice_leave() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.voice_ping(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.voice_set_state(boolean,boolean,boolean,boolean) TO authenticated, service_role;

-- Backend-only public routines: service_role only (not exposed to browser users).
GRANT EXECUTE ON FUNCTION public.get_auth_user_by_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_login_email_by_username(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_user_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rate_check(text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_email_code(text,text,text,integer) TO service_role;

-- Private helpers referenced directly by RLS policies.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_voice_topic(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_channel_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_channel_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_dm_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_attachment(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.shares_server_with(uuid) TO authenticated;

-- Trigger-only functions remain executable by their owner/postgres, not API roles.
-- Do not grant authenticated/anon on accept_on_reply, check_thread_parent,
-- dm_allowed, messages_rate_limit, touch_edited_at or touch_profile.
-- private.is_dm_member is required by channels_select_member and is granted above.
-- private.can_read_attachment is required by the private attachments Storage SELECT policy.
-- private.remove_from_server is callable only from its owning privileged routines.
-- Apply REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated, service_role first,
-- then grants above. Confirm trigger execution and policy calls with role tests.
