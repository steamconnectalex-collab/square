-- Square. — banco de dados do acesso à conta (estado atual em produção)
-- Projeto Supabase "square" (ref vjkqyqdabypdylhoupha, região sa-east-1).
-- Este arquivo é um retrato do que existe hoje; serve de referência e para recriar o banco.
-- Segurança: todas as tabelas têm RLS ligado; o backend (Edge Function "auth") usa a service_role.

-- ---------- perfis ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9._]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  birth_date date,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower_key on public.profiles (lower(username));
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- ---------- códigos de e-mail (cadastro e recuperação de senha) ----------
create table public.email_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('signup', 'reset')),
  code_hash text not null,          -- HMAC do código; o código em si nunca é guardado
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_codes_lookup_idx on public.email_codes (email, purpose, created_at desc);
create index email_codes_expires_idx on public.email_codes (expires_at);
alter table public.email_codes enable row level security;
revoke all on public.email_codes from anon, authenticated;
grant all on public.email_codes to service_role;

-- ---------- login por QR Code ----------
create table public.qr_sessions (
  id uuid primary key default gen_random_uuid(),
  approve_hash text not null,       -- segredo que vai dentro do QR (guardado só como hash)
  poll_hash text not null,          -- segredo que só o navegador que mostra o QR conhece
  status text not null default 'pending' check (status in ('pending', 'approved', 'consumed', 'denied')),
  approved_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  requester_ua text                 -- aparelho que pediu o QR (mostrado a quem autoriza)
);
create index qr_sessions_expires_idx on public.qr_sessions (expires_at);
create index qr_sessions_approved_by_idx on public.qr_sessions (approved_by);
alter table public.qr_sessions enable row level security;
revoke all on public.qr_sessions from anon, authenticated;
grant all on public.qr_sessions to service_role;

-- ---------- limite de tentativas ----------
create table public.rate_hits (
  key text not null,
  at timestamptz not null default now()
);
create index rate_hits_key_at_idx on public.rate_hits (key, at desc);
alter table public.rate_hits enable row level security;
revoke all on public.rate_hits from anon, authenticated;
grant all on public.rate_hits to service_role;

-- ---------- funções (só a service_role pode executar) ----------
create or replace function public.get_auth_user_by_email(p_email text)
returns table(id uuid, email_confirmed boolean)
language sql security definer set search_path to ''
as $$
  select u.id, (u.email_confirmed_at is not null)
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1
$$;

create or replace function public.get_login_email_by_username(p_username text)
returns text
language sql security definer set search_path to ''
as $$
  select u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(p_username)
  limit 1
$$;

create or replace function public.rate_check(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare
  n integer;
begin
  delete from public.rate_hits
  where key = p_key and at < now() - make_interval(secs => p_window_seconds);

  if random() < 0.02 then
    delete from public.rate_hits where at < now() - interval '1 day';
  end if;

  select count(*) into n from public.rate_hits where key = p_key;
  if n >= p_limit then
    return false;
  end if;

  insert into public.rate_hits (key) values (p_key);
  return true;
end;
$$;

create or replace function public.revoke_user_sessions(p_user uuid)
returns void
language sql security definer set search_path to ''
as $$
  delete from auth.sessions where user_id = p_user;
$$;

create or replace function public.verify_email_code(p_email text, p_purpose text, p_hash text, p_max_attempts integer default 5)
returns table(status text, attempts_left integer)
language plpgsql security definer set search_path to ''
as $$
declare
  r public.email_codes%rowtype;
begin
  select * into r
  from public.email_codes
  where email = p_email
    and purpose = p_purpose
    and consumed_at is null
  order by created_at desc
  limit 1
  for update;

  if not found or r.expires_at < now() then
    return query select 'expired'::text, 0;
    return;
  end if;

  if r.attempts >= p_max_attempts then
    return query select 'locked'::text, 0;
    return;
  end if;

  if r.code_hash = p_hash then
    update public.email_codes set consumed_at = now() where id = r.id;
    return query select 'ok'::text, p_max_attempts - r.attempts;
    return;
  end if;

  update public.email_codes set attempts = attempts + 1 where id = r.id;
  return query select 'wrong'::text, greatest(p_max_attempts - r.attempts - 1, 0);
end;
$$;

revoke all on function public.get_auth_user_by_email(text) from public, anon, authenticated;
revoke all on function public.get_login_email_by_username(text) from public, anon, authenticated;
revoke all on function public.rate_check(text, integer, integer) from public, anon, authenticated;
revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
revoke all on function public.verify_email_code(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.get_auth_user_by_email(text) to service_role;
grant execute on function public.get_login_email_by_username(text) to service_role;
grant execute on function public.rate_check(text, integer, integer) to service_role;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
grant execute on function public.verify_email_code(text, text, text, integer) to service_role;
