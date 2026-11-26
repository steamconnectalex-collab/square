-- 0022: tópicos (respostas em fio) e correção da descrição de imagem.
-- (já aplicada no Supabase em 2026-11-24)

-- 1) a coluna attachment_alt não tinha permissão de gravação
grant insert (attachment_alt) on public.messages to authenticated;

-- 2) tópicos: uma mensagem pode ser resposta de outra (só um nível)
alter table public.messages
  add column if not exists thread_of bigint references public.messages(id) on delete cascade;
create index if not exists messages_thread_idx on public.messages (thread_of) where thread_of is not null;
grant select (thread_of), insert (thread_of) on public.messages to authenticated;

-- 3) a mensagem-pai precisa existir, estar no mesmo canal e não ser ela mesma uma resposta
create or replace function private.check_thread_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  if new.thread_of is null then return new; end if;
  select channel_id, thread_of into p from public.messages where id = new.thread_of;
  if not found or p.channel_id <> new.channel_id or p.thread_of is not null then
    raise exception 'invalid_thread';
  end if;
  return new;
end $$;

drop trigger if exists messages_check_thread on public.messages;
create trigger messages_check_thread before insert on public.messages
  for each row execute function private.check_thread_parent();
