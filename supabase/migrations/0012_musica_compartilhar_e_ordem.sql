-- Square. — música: compartilhar playlist e mudar a ordem das faixas (migração 0012).
alter table public.playlists add column if not exists shared boolean not null default false;
grant update (shared) on public.playlists to authenticated;      -- (name) já estava liberado
grant update (position) on public.playlist_tracks to authenticated;

-- Quem recebe o link de uma playlist compartilhada pode ler a playlist e as faixas (só leitura).
drop policy if exists pl_shared_read on public.playlists;
create policy pl_shared_read on public.playlists for select to authenticated using (shared);
drop policy if exists plt_shared_read on public.playlist_tracks;
create policy plt_shared_read on public.playlist_tracks for select to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.shared));

-- Troca a faixa de lugar com a vizinha (p_dir = -1 sobe, 1 desce). Roda com as permissões de quem chama: só funciona na própria playlist.
create or replace function public.playlist_move(p_track bigint, p_dir integer) returns void
language plpgsql security invoker set search_path = '' as $$
declare a public.playlist_tracks; b public.playlist_tracks;
begin
  select * into a from public.playlist_tracks where id = p_track;
  if not found then raise exception 'not_found'; end if;
  if p_dir < 0 then
    select * into b from public.playlist_tracks where playlist_id = a.playlist_id and (position, id) < (a.position, a.id) order by position desc, id desc limit 1;
  else
    select * into b from public.playlist_tracks where playlist_id = a.playlist_id and (position, id) > (a.position, a.id) order by position asc, id asc limit 1;
  end if;
  if not found then return; end if;
  update public.playlist_tracks set position = case id when a.id then b.position else a.position end where id in (a.id, b.id);
end $$;

-- Salva uma cópia (sua) de uma playlist compartilhada.
create or replace function public.playlist_copy(p_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare n uuid; nm text;
begin
  select name into nm from public.playlists where id = p_id;
  if not found then raise exception 'not_found'; end if;
  insert into public.playlists (name) values (left(nm, 30) || ' (cópia)') returning id into n;
  insert into public.playlist_tracks (playlist_id, track, position)
    select n, track, row_number() over (order by position, id) from public.playlist_tracks where playlist_id = p_id;
  return n;
end $$;
revoke all on function public.playlist_move(bigint, integer), public.playlist_copy(uuid) from public, anon;
grant execute on function public.playlist_move(bigint, integer), public.playlist_copy(uuid) to authenticated;
