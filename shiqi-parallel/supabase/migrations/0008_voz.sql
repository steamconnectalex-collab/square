-- Square. — chamadas de voz (migração 0008).
-- Quem está em cada sala fica em voice_members (lista visível aos membros do servidor).
-- O áudio vai direto entre as pessoas (WebRTC); a "conversa de bastidores" (ofertas/respostas) passa por um canal
-- privado do Realtime, liberado só para membros do servidor dono do canal de voz.
create table if not exists public.voice_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists voice_members_user_idx on public.voice_members (user_id);
alter table public.voice_members enable row level security;
revoke all on public.voice_members from anon, authenticated;
grant select on public.voice_members to authenticated;
drop policy if exists voice_members_select on public.voice_members;
create policy voice_members_select on public.voice_members for select to authenticated
  using (private.is_channel_member(channel_id));

create or replace function public.voice_join(p_channel uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.channels c join public.server_members m on m.server_id = c.server_id
                 where c.id = p_channel and c.kind = 'voice' and m.user_id = uid) then
    raise exception 'not_member';
  end if;
  delete from public.voice_members where channel_id = p_channel and seen_at < now() - interval '45 seconds';
  delete from public.voice_members where user_id = uid and channel_id <> p_channel;
  select count(*) into n from public.voice_members where channel_id = p_channel and user_id <> uid;
  if n >= 6 then raise exception 'voice_full'; end if;
  insert into public.voice_members (channel_id, user_id) values (p_channel, uid)
  on conflict (channel_id, user_id) do update set seen_at = now();
end;
$$;

create or replace function public.voice_ping(p_channel uuid) returns void
language sql security definer set search_path = '' as $$
  update public.voice_members set seen_at = now() where channel_id = p_channel and user_id = (select auth.uid());
$$;

create or replace function public.voice_leave() returns void
language sql security definer set search_path = '' as $$
  delete from public.voice_members where user_id = (select auth.uid());
$$;

revoke all on function public.voice_join(uuid), public.voice_ping(uuid), public.voice_leave() from public, anon;
grant execute on function public.voice_join(uuid), public.voice_ping(uuid), public.voice_leave() to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'voice_members') then
    alter publication supabase_realtime add table public.voice_members;
  end if;
end $$;

-- Canal privado "voice:<id do canal>": só membro do servidor lê e escreve.
create or replace function private.can_voice_topic(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_topic !~ '^voice:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return exists (select 1 from public.channels c join public.server_members m on m.server_id = c.server_id
                 where c.id = substring(p_topic from 7)::uuid and c.kind = 'voice' and m.user_id = (select auth.uid()));
end;
$$;
revoke all on function private.can_voice_topic(text) from public, anon;
grant execute on function private.can_voice_topic(text) to authenticated;

drop policy if exists voice_topic_select on realtime.messages;
drop policy if exists voice_topic_insert on realtime.messages;
create policy voice_topic_select on realtime.messages for select to authenticated
  using (extension = 'broadcast' and private.can_voice_topic((select realtime.topic())));
create policy voice_topic_insert on realtime.messages for insert to authenticated
  with check (extension = 'broadcast' and private.can_voice_topic((select realtime.topic())));
