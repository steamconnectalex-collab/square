-- SHIQI: aumenta a capacidade das salas de voz de 6 para 10 participantes.
-- A serialização por advisory lock impede que entradas simultâneas ultrapassem o limite.
-- Mantém a regra existente: cada usuário participa de apenas uma sala por vez.

create or replace function public.voice_join(p_channel uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Serializa tentativas simultâneas do mesmo usuário e da mesma sala.
  -- A ordem fixa (usuário -> canal) evita deadlocks entre chamadas concorrentes.
  perform pg_advisory_xact_lock(hashtextextended('shiqi:voice:user:' || uid::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('shiqi:voice:channel:' || p_channel::text, 0));

  if not exists (
    select 1
      from public.channels c
      join public.server_members m on m.server_id = c.server_id
     where c.id = p_channel
       and c.kind = 'voice'
       and m.user_id = uid
  ) then
    raise exception 'not_member';
  end if;

  -- Remove presenças expiradas e mantém o comportamento original de uma sala por usuário.
  delete from public.voice_members
   where channel_id = p_channel
     and seen_at < now() - interval '45 seconds';

  delete from public.voice_members
   where user_id = uid
     and channel_id <> p_channel;

  select count(*)
    into n
    from public.voice_members
   where channel_id = p_channel
     and user_id <> uid;

  if n >= 10 then
    raise exception 'voice_full';
  end if;

  insert into public.voice_members (channel_id, user_id)
  values (p_channel, uid)
  on conflict (channel_id, user_id)
  do update set
    seen_at = now(),
    muted = false,
    deafened = false,
    video = false,
    screen = false;
end;
$$;

revoke all on function public.voice_join(uuid) from public, anon;
grant execute on function public.voice_join(uuid) to authenticated;

-- Serializa a saída com voice_join para uma resposta atrasada de "sair"
-- não remover uma entrada recém-criada em outra sala.
create or replace function public.voice_leave() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('shiqi:voice:user:' || uid::text, 0));
  delete from public.voice_members where user_id = uid;
end;
$$;
