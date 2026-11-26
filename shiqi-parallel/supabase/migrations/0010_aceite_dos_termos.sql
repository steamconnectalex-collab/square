-- Square. — aceite dos termos (migração 0010). Já aplicada no Supabase com o nome "aceite_dos_termos"; guardada aqui só como registro.
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
