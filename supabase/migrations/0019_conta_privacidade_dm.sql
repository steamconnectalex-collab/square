-- Etapa C: conta (desativar/excluir, 2 etapas), privacidade do perfil, DMs de membros de servidor, GIF e descrição de imagem.

-- 1) colunas novas
alter table public.profiles add column if not exists deactivated_at timestamptz;
alter table public.profiles add column if not exists profile_updated_at timestamptz;
alter table public.messages add column if not exists attachment_alt text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_alt_len') then
    alter table public.messages add constraint messages_alt_len check (attachment_alt is null or length(attachment_alt) <= 300);
  end if;
end $$;
alter table public.email_codes drop constraint if exists email_codes_purpose_check;
alter table public.email_codes add constraint email_codes_purpose_check check (purpose = any (array['signup','reset','change']));
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'] where id = 'attachments';

-- 2) códigos de recuperação da verificação em duas etapas (só a função auth, com chave de serviço, mexe)
create table if not exists public.mfa_recovery (
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  primary key (user_id, code_hash)
);
alter table public.mfa_recovery enable row level security;

-- 3) perfil: contas desativadas somem para os outros; bio/status/cor/"membro desde" passam por função que respeita a privacidade
drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (deactivated_at is null and private.shares_server_with(id)));
revoke select (bio, status_text, accent, created_at) on public.profiles from authenticated;
grant select (deactivated_at, profile_updated_at) on public.profiles to authenticated;

create or replace function public.profiles_full(p_ids uuid[])
returns table (id uuid, bio text, status_text text, accent text, created_at timestamptz, profile_updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as uid)
  select p.id,
         case when q.full then p.bio else '' end,
         case when q.full then p.status_text else '' end,
         case when q.full then p.accent else '#9D8CCF' end,
         case when q.full then p.created_at else null end,
         case when q.full then p.profile_updated_at else null end
  from public.profiles p
  cross join me
  cross join lateral (
    select (p.id = me.uid) or (
      case coalesce(p.settings->>'profile_share', 'all')
        when 'friends' then fr.is_friend
        when 'small'   then fr.is_friend or sm.small
        else true
      end) as full
    from (select exists (select 1 from public.friendships f where f.status = 'accepted'
                          and f.user_a = least(me.uid, p.id) and f.user_b = greatest(me.uid, p.id)) as is_friend) fr,
         (select exists (select 1 from public.server_members a join public.server_members b on b.server_id = a.server_id
                          where a.user_id = me.uid and b.user_id = p.id
                            and (select count(*) from public.server_members x where x.server_id = a.server_id) <= 200) as small) sm
  ) q
  where p.id = any (p_ids[1:200])
    and (p.id = me.uid or (p.deactivated_at is null and private.shares_server_with(p.id)));
$$;
revoke all on function public.profiles_full(uuid[]) from public, anon;
grant execute on function public.profiles_full(uuid[]) to authenticated;

-- "Compartilhar quando eu atualizar meu perfil": só marca a atualização se a pessoa deixou ligado
create or replace function private.touch_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.bio is distinct from old.bio or new.display_name is distinct from old.display_name or new.avatar_path is distinct from old.avatar_path
      or new.accent is distinct from old.accent or new.status_text is distinct from old.status_text)
     and coalesce((new.settings->>'share_profile_update')::boolean, true) then
    new.profile_updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_touch_profile on public.profiles;
create trigger trg_touch_profile before update on public.profiles for each row execute function private.touch_profile();

-- 4) reativar conta ao entrar de novo
create or replace function public.reactivate_account() returns void language sql security definer set search_path = '' as $$
  update public.profiles set deactivated_at = null where id = (select auth.uid()) and deactivated_at is not null;
$$;
revoke all on function public.reactivate_account() from public, anon;
grant execute on function public.reactivate_account() to authenticated;

-- 5) excluir conta: repassa servidores para o membro mais antigo (ou apaga se ficou vazio); o resto some por cascata
create or replace function public.purge_user_data(p_user uuid) returns void language plpgsql security definer set search_path = '' as $$
declare s record; nxt uuid;
begin
  for s in select id from public.servers where owner_id = p_user loop
    select user_id into nxt from public.server_members where server_id = s.id and user_id <> p_user order by joined_at limit 1;
    if nxt is null then delete from public.servers where id = s.id;
    else update public.servers set owner_id = nxt where id = s.id; end if;
  end loop;
end $$;
revoke all on function public.purge_user_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_user_data(uuid) to service_role;

-- 6) DMs com membros do mesmo servidor (respeitando "Mensagens Diretas" e "Solicitações de mensagens")
alter table public.dm_members add column if not exists state text not null default 'active';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dm_members_state_chk') then
    alter table public.dm_members add constraint dm_members_state_chk check (state in ('active', 'request'));
  end if;
end $$;

create or replace function private.dm_allowed(a uuid, b uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a))
    and (exists (select 1 from public.friendships f where f.status = 'accepted' and f.user_a = least(a, b) and f.user_b = greatest(a, b))
      or exists (select 1 from public.server_members x join public.server_members y on y.server_id = x.server_id where x.user_id = a and y.user_id = b))
$$;

create or replace function private.can_post(p_channel uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.channels c join public.server_members m on m.server_id = c.server_id
    where c.id = p_channel and c.kind = 'text' and m.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.dm_members d1
    join public.dm_members d2 on d2.channel_id = d1.channel_id and d2.user_id <> d1.user_id
    where d1.channel_id = p_channel and d1.user_id = (select auth.uid()) and private.dm_allowed(d1.user_id, d2.user_id)
  )
$$;

create or replace function public.open_dm(p_other uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); ch uuid; cfg jsonb; v_allow boolean; v_noreq boolean; st text := 'active'; fr boolean;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_other is null or p_other = me then raise exception 'cannot_add_self'; end if;
  if exists (select 1 from public.blocks where (blocker = me and blocked = p_other) or (blocker = p_other and blocked = me)) then raise exception 'dm_closed'; end if;
  fr := exists (select 1 from public.friendships where user_a = least(me, p_other) and user_b = greatest(me, p_other) and status = 'accepted');
  if not fr then
    if not exists (select 1 from public.server_members a join public.server_members b on b.server_id = a.server_id where a.user_id = me and b.user_id = p_other) then
      raise exception 'not_friends';
    end if;
    select coalesce(settings, '{}'::jsonb) into cfg from public.profiles where id = p_other;
    select bool_or(q.ea), bool_or(q.ea and not q.er) into v_allow, v_noreq from (
      select coalesce((cfg->'dm_over'->(a.server_id::text)->>'allow')::boolean, coalesce((cfg->>'dm_allow')::boolean, true)) as ea,
             coalesce((cfg->'dm_over'->(a.server_id::text)->>'req')::boolean, coalesce((cfg->>'dm_requests')::boolean, true)) as er
      from public.server_members a join public.server_members b on b.server_id = a.server_id
      where a.user_id = me and b.user_id = p_other) q;
    if not coalesce(v_allow, false) then raise exception 'dm_closed'; end if;
    if not coalesce(v_noreq, false) then st := 'request'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext(least(me, p_other)::text || greatest(me, p_other)::text));
  select d1.channel_id into ch from public.dm_members d1 join public.dm_members d2 on d2.channel_id = d1.channel_id
    where d1.user_id = me and d2.user_id = p_other limit 1;
  if ch is null then
    insert into public.channels (server_id, name, kind) values (null, 'dm', 'dm') returning id into ch;
    insert into public.dm_members (channel_id, user_id, state) values (ch, me, 'active'), (ch, p_other, st);
  end if;
  return ch;
end $$;

create or replace function public.respond_dm_request(p_channel uuid, p_accept boolean) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_accept then
    update public.dm_members set state = 'active' where channel_id = p_channel and user_id = me and state = 'request';
  else
    delete from public.dm_members where channel_id = p_channel and user_id = me and state = 'request';
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'no_request'; end if;
end $$;
revoke all on function public.respond_dm_request(uuid, boolean) from public, anon;
grant execute on function public.respond_dm_request(uuid, boolean) to authenticated;

-- responder numa solicitação conta como aceitar
create or replace function private.accept_on_reply() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.dm_members set state = 'active' where channel_id = new.channel_id and user_id = new.author_id and state = 'request';
  return new;
end $$;
drop trigger if exists trg_accept_on_reply on public.messages;
create trigger trg_accept_on_reply after insert on public.messages for each row execute function private.accept_on_reply();
