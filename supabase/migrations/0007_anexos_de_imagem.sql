-- Square. — anexos de imagem nas mensagens (migração 0007).
-- A imagem fica no bucket público "attachments" (leitura por link com nome aleatório); cada pessoa só grava/apaga na própria pasta.
alter table public.messages add column if not exists attachment_path text
  check (attachment_path is null or char_length(attachment_path) <= 200);
grant insert (channel_id, content, attachment_path) on public.messages to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists attachments_insert_own on storage.objects;
drop policy if exists attachments_delete_own on storage.objects;
drop policy if exists attachments_select_own on storage.objects;
create policy attachments_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_select_own on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
