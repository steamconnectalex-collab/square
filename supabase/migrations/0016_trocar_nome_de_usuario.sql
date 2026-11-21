-- Square. — Trocar @usuário pelas Configurações (migração 0016; aplicada como "trocar_nome_de_usuario").
create or replace function public.change_username(p_username text) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); u text := lower(btrim(coalesce(p_username, '')));
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if u !~ '^[a-z0-9._]{3,20}$' then raise exception 'invalid_username'; end if;
  if exists (select 1 from public.profiles p where lower(p.username) = u and p.id <> uid) then raise exception 'username_taken'; end if;
  update public.profiles set username = u where id = uid;
  return u;
end $$;
revoke all on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;
