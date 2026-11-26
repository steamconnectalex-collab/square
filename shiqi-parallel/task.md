# SHIQI — acompanhamento

Última atualização: 2026-11-26

## Concluído
- [x] Criada a branch isolada `shiqi-parallel-dev`.
- [x] Criada a pasta `shiqi-parallel/`.
- [x] Registrada a auditoria inicial e as regras de isolamento.
- [x] Criada a primeira fundação visual estática, sem ligação com serviços reais.

## Em andamento
- [x] 2026-11-26 — Criado projeto Vercel independente `shiqi-parallel` (Root Directory `shiqi-parallel/apps/web`), sem domínio próprio.
- [x] 2026-11-26 — Primeira prévia publicada: https://shiqi-parallel.vercel.app (deployment `dpl_CM2GT6vCigETMKWAeitLNSFn9cFo`). O deployment foi classificado pela Vercel como `production` dentro do projeto NOVO `shiqi-parallel`; não está ligado ao projeto/domínio `square-chat` nem ao domínio `shiqi.com.br`.
- [ ] Ligar automaticamente o projeto Vercel novo ao mesmo repositório com Root Directory correto. O primeiro deploy foi enviado diretamente por SHA; pushes futuros ainda não estão confirmados como automáticos.
- [x] 2026-11-26 — Criado Supabase independente `shiqi-parallel` em São Paulo (`sa-east-1`), projeto `ujdosskjycrdkcgsswfa`; cotação de criação US$ 0,00/mês.
- [ ] Preparar credencial Resend exclusiva para testes (não reutilizar chave existente).
- [x] 2026-11-26 — Criado schema inicial: perfis, comunidades, membros, canais e mensagens.
- [x] 2026-11-26 — RLS ativado em todas as cinco tabelas; funções auxiliares movidas para schema privado; auditoria de segurança sem findings.
- [x] 2026-11-26 — Adicionada criação automática de perfil após cadastro no Supabase Auth.
- [x] 2026-11-26 — Interface conectada à autenticação por e-mail/senha e criação de comunidades com canal `#geral`.
- [x] 2026-11-26 — Publicado Preview atualizado: https://shiqi-parallel-git-shiqi-parallel-dev-steamconnectalex-9536.vercel.app (deployment `dpl_iigwSgpVBoYkV2YnPriAftqiQTcS`).
- [x] 2026-11-26 — Preview atualizado com o chat de comunidades: https://shiqi-parallel-git-shiqi-parallel-dev-steamconnectalex-9536.vercel.app (deployment `dpl_4ioMPc4K6FWLbTDixZA93oyF9hne`).

## Próximos passos
- [ ] Testar cadastro, confirmação de e-mail, login e criação de comunidade no Preview.
- [ ] Configurar deploy automático da branch `shiqi-parallel-dev` (atualmente o Preview é publicado por deployment direto; a conexão Git automática ainda não está comprovada).
- [x] 2026-11-26 — Implementada lista de canais, histórico das últimas 100 mensagens, envio e atualização em tempo real no chat da comunidade.
- [ ] Implementar mensagens diretas e amizades.
- [ ] Configurar e-mail transacional com credencial Resend exclusiva e SMTP/Auth, sem reutilizar credenciais da versão original.
- [ ] Rever avisos de performance após haver tráfego real; os índices ainda aparecem como não utilizados porque o banco está vazio.
