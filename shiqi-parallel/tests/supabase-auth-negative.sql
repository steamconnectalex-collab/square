-- SHIQI: testes negativos de RPC sem identidade autenticada.
-- Executar no Supabase paralelo (SQL Editor). A transação sempre termina em ROLLBACK.
-- Simula o role authenticated sem sub JWT; não substitui teste com JWT real ou duas contas.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);

do $test$
declare
  call_sql text;
  actual text;
  dummy constant text := '''00000000-0000-0000-0000-000000000001''';
begin
  foreach call_sql in array array[
    'select public.block_user(' || dummy || ')',
    'select public.create_server(''SHIQI-AUTH-NEGATIVE-TEST'')',
    'select public.create_invite(' || dummy || ')',
    'select public.open_dm(' || dummy || ')',
    'select public.send_friend_request(''no-such-test-user'')',
    'select public.toggle_reaction(1, ''x'')',
    'select public.voice_join(' || dummy || ')',
    'select public.save_my_settings(''{}''::jsonb)',
    'select public.ban_member(' || dummy || ', ' || dummy || ')',
    'select public.kick_member(' || dummy || ', ' || dummy || ')'
  ] loop
    begin
      execute call_sql;
      raise exception 'SHIQI_TEST_UNEXPECTED_SUCCESS: %', call_sql;
    exception when others then
      get stacked diagnostics actual = message_text;
      if position('SHIQI_TEST_UNEXPECTED_SUCCESS:' in actual) = 1 then
        raise;
      end if;
      if actual <> 'not_authenticated' then
        raise exception 'SHIQI_TEST_WRONG_ERROR for %: %', call_sql, actual;
      end if;
    end;
  end loop;

  if public.is_server_member('00000000-0000-0000-0000-000000000001'::uuid) is distinct from false then
    raise exception 'SHIQI_TEST_IS_MEMBER_SHOULD_BE_FALSE';
  end if;
  if public.get_my_settings() is distinct from '{}'::jsonb then
    raise exception 'SHIQI_TEST_SETTINGS_SHOULD_BE_EMPTY';
  end if;
  if exists (select 1 from public.profiles_full(array['00000000-0000-0000-0000-000000000001'::uuid])) then
    raise exception 'SHIQI_TEST_PROFILES_FULL_LEAKED_ROWS';
  end if;
end
$test$;

rollback;
