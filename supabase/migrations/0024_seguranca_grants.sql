-- Tabelas que só a função de backend (service_role) usa: ninguém mais precisa de acesso.
revoke all on public.mfa_recovery from anon, authenticated;
revoke all on public.email_codes from anon, authenticated;
revoke all on public.qr_sessions from anon, authenticated;
revoke all on public.rate_hits from anon, authenticated;
