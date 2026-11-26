-- Square. — Servidores destaque (migração 0014; já aplicada no Supabase como "servidores_destaque_e_plano").
-- Nível do servidor (ainda sem sistema que o aumente; padrão 1) e plano da conta (padrão 'free').
-- Destaque: servidores públicos com nível >= 3 (valor provisório, a pessoa vai definir 3 ou 5). 4 por vez, troca a cada 48 h.
alter table public.servers add column if not exists level integer not null default 1 check (level between 1 and 10);

alter table public.profiles add column if not exists plan text not null default 'free';

create or replace function public.my_plan() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.plan from public.profiles p where p.id = auth.uid()), 'free');
$$;

create or replace function public.featured_servers() returns table (id uuid, name text, level integer, members integer, joined boolean, until_ts timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  win bigint := floor(extract(epoch from now()) / 172800)::bigint;  -- janela de 48 h
  total integer; pages integer; pg integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select count(*) into total from public.servers s
   where s.is_public and s.level >= 3
     and not exists (select 1 from public.server_bans b where b.server_id = s.id and b.user_id = uid);
  if total = 0 then return; end if;
  pages := greatest(1, ceil(total / 4.0)::integer);
  pg := (win % pages)::integer;
  return query
    select r.id, r.name, r.level, r.members, r.joined, to_timestamp((win + 1) * 172800.0)
    from (
      select s.id, s.name, s.level,
             (select count(*)::integer from public.server_members m where m.server_id = s.id) as members,
             exists (select 1 from public.server_members m where m.server_id = s.id and m.user_id = uid) as joined,
             row_number() over (order by md5(s.id::text)) as rn
      from public.servers s
      where s.is_public and s.level >= 3
        and not exists (select 1 from public.server_bans b where b.server_id = s.id and b.user_id = uid)
    ) r
    where r.rn > pg * 4 and r.rn <= pg * 4 + 4
    order by r.rn;
end $$;

revoke all on function public.my_plan(), public.featured_servers() from public, anon;
grant execute on function public.my_plan(), public.featured_servers() to authenticated;
