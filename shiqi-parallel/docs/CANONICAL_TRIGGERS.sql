-- SHIQI — RPC/helper público e triggers do schema original.
-- Referência de reconstrução. Funções privadas devem existir antes dos triggers.

create or replace function public.is_server_member(p_server uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.server_members m
    where m.server_id = p_server and m.user_id = (select auth.uid())
  )
$function$;

create trigger messages_check_thread
before insert on public.messages
for each row execute function private.check_thread_parent();

create trigger messages_rate_limit
before insert on public.messages
for each row execute function private.messages_rate_limit();

create trigger messages_touch_edited
before update on public.messages
for each row execute function private.touch_edited_at();

create trigger trg_accept_on_reply
after insert on public.messages
for each row execute function private.accept_on_reply();

create trigger trg_touch_profile
before update on public.profiles
for each row execute function private.touch_profile();
