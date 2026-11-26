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
- [ ] Preparar projeto Supabase independente (aguardando confirmação da organização e eventual custo).
- [ ] Preparar credencial Resend exclusiva para testes (não reutilizar chave existente).
- [ ] Validar o protótipo visual e definir o primeiro fluxo funcional.

## Próximo passo
Validar a primeira interface e, em seguida, conectar somente serviços paralelos e vazios.
