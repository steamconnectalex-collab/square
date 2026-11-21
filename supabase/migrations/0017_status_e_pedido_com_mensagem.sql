-- Square. — Status de presença (Disponível/Ausente/Não perturbe/Invisível) e mensagem no pedido de amizade.
alter table public.profiles add column if not exists presence text not null default 'online' check (presence in ('online','idle','dnd','invisible'));
grant select (presence) on public.profiles to authenticated;

create or replace function public.set_my_presence(p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_status not in ('online','idle','dnd','invisible') then raise exception 'invalid_status'; end if;
  update public.profiles set presence = p_status where id = auth.uid();
end $$;
revoke all on function public.set_my_presence(text) from public, anon;
grant execute on function public.set_my_presence(text) to authenticated;

alter table public.friendships add column if not exists note text check (note is null or char_length(note) <= 120);

-- Pedido com mensagem opcional (até 120 letras). A versão antiga (só @usuário) continua existindo.
create or replace function public.send_friend_request(p_username text, p_note text) returns text
language plpgsql security definer set search_path = '' as $$
declare r text; me uuid := auth.uid(); other uuid; nt text := nullif(btrim(coalesce(p_note, '')), '');
begin
  r := public.send_friend_request(p_username);
  if r = 'pending' and nt is not null then
    select id into other from public.profiles where lower(username) = lower(regexp_replace(btrim(coalesce(p_username, '')), '^@', ''));
    update public.friendships set note = left(nt, 120)
      where user_a = least(me, other) and user_b = greatest(me, other) and requester = me and status = 'pending';
  end if;
  return r;
end $$;
revoke all on function public.send_friend_request(text, text) from public, anon;
grant execute on function public.send_friend_request(text, text) to authenticated;

-- Ao aceitar, a mensagem do pedido vira a primeira mensagem da conversa privada.
create or replace function public.respond_friend_request(p_other uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); a uuid; b uuid; n int; nt text; ch uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  a := least(me, p_other); b := greatest(me, p_other);
  if p_accept then
    update public.friendships set status = 'accepted' where user_a = a and user_b = b and status = 'pending' and requester = p_other returning note into nt;
    get diagnostics n = row_count;
    if n > 0 and nt is not null and btrim(nt) <> '' then
      perform pg_advisory_xact_lock(hashtext(a::text || b::text));
      select d1.channel_id into ch from public.dm_members d1 join public.dm_members d2 on d2.channel_id = d1.channel_id
        where d1.user_id = me and d2.user_id = p_other limit 1;
      if ch is null then
        insert into public.channels (server_id, name, kind) values (null, 'dm', 'dm') returning id into ch;
        insert into public.dm_members (channel_id, user_id) values (ch, me), (ch, p_other);
      end if;
      insert into public.messages (channel_id, author_id, content) values (ch, p_other, nt);
    end if;
  else
    delete from public.friendships where user_a = a and user_b = b and status = 'pending' and requester = p_other;
    get diagnostics n = row_count;
  end if;
  if n = 0 then raise exception 'no_request'; end if;
end $$;
