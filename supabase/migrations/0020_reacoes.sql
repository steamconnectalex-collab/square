-- Reações em mensagens (aplicada no Supabase em 2026-11-24)
create table if not exists public.message_reactions (
  message_id bigint not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists message_reactions_msg_idx on public.message_reactions (message_id);
alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from anon, authenticated;
grant select on public.message_reactions to authenticated;
grant all on public.message_reactions to service_role;
create policy reactions_select_visible on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and private.is_channel_member(m.channel_id)));

create or replace function public.toggle_reaction(p_message bigint, p_emoji text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); ch uuid; n int; e text := btrim(coalesce(p_emoji, ''));
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if char_length(e) < 1 or char_length(e) > 16 then raise exception 'invalid_emoji'; end if;
  select channel_id into ch from public.messages where id = p_message;
  if ch is null or not private.can_post(ch) then raise exception 'not_member'; end if;
  delete from public.message_reactions where message_id = p_message and user_id = me and emoji = e;
  get diagnostics n = row_count;
  if n > 0 then return false; end if;
  if (select count(distinct emoji) from public.message_reactions where message_id = p_message) >= 20 then raise exception 'too_many_reactions'; end if;
  insert into public.message_reactions (message_id, user_id, emoji) values (p_message, me, e);
  return true;
end $$;
revoke all on function public.toggle_reaction(bigint, text) from public, anon;
grant execute on function public.toggle_reaction(bigint, text) to authenticated;
