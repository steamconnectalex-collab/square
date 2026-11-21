-- Square. — Configurações da conta (migração 0015).
-- Preferências ficam em profiles.settings (JSON). Ninguém lê as de outra pessoa: só pelas funções abaixo, que usam auth.uid().
alter table public.profiles add column if not exists settings jsonb not null default '{}'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_settings_size') then
    alter table public.profiles add constraint profiles_settings_size check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 8192);
  end if;
end $$;

create or replace function public.get_my_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.settings from public.profiles p where p.id = auth.uid()), '{}'::jsonb);
$$;

create or replace function public.save_my_settings(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 6000 then raise exception 'invalid_settings'; end if;
  update public.profiles set settings = p where id = auth.uid();
end $$;

-- 'adult' (18+), 'teen' (13 a 17) ou 'unknown' (sem data de nascimento). A data em si continua privada.
create or replace function public.my_age_group() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select case when p.birth_date is null then 'unknown'
                               when p.birth_date <= (current_date - interval '18 years')::date then 'adult'
                               else 'teen' end
                   from public.profiles p where p.id = auth.uid()), 'unknown');
$$;

create or replace function public.unsubscribe_marketing() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.profiles set marketing_opt_in = false where id = auth.uid();
end $$;

revoke all on function public.get_my_settings(), public.save_my_settings(jsonb), public.my_age_group(), public.unsubscribe_marketing() from public, anon;
grant execute on function public.get_my_settings(), public.save_my_settings(jsonb), public.my_age_group(), public.unsubscribe_marketing() to authenticated;
