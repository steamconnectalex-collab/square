-- 0023: estado de cada pessoa na chamada de voz (mudo, ensurdecido, câmera, tela).
-- Todos da sala veem o estado em tempo real (voice_members já está no Realtime).
-- Quem fala é detectado no próprio navegador (áudio recebido), por isso não precisa de coluna.

alter table public.voice_members
  add column if not exists muted    boolean not null default false,
  add column if not exists deafened boolean not null default false,
  add column if not exists video    boolean not null default false,
  add column if not exists screen   boolean not null default false;

-- leitura da tabela inteira já está liberada para membros do servidor (política voice_members_select)

-- só a própria pessoa muda o próprio estado; ensurdecer implica ficar mudo
create or replace function public.voice_set_state(p_muted boolean, p_deafened boolean, p_video boolean, p_screen boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  update public.voice_members
     set muted = coalesce(p_muted, false) or coalesce(p_deafened, false),
         deafened = coalesce(p_deafened, false),
         video = coalesce(p_video, false),
         screen = coalesce(p_screen, false),
         seen_at = now()
   where user_id = uid;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'not_in_voice'; end if;
end $$;

revoke all on function public.voice_set_state(boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.voice_set_state(boolean, boolean, boolean, boolean) to authenticated;

-- ao entrar de novo na sala, o estado volta ao padrão
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
  on conflict (channel_id, user_id) do update set seen_at = now(), muted = false, deafened = false, video = false, screen = false;
end;
$$;
