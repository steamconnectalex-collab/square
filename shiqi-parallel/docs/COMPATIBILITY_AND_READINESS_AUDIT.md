# SHIQI — auditoria de compatibilidade e plano de preparação

Data da auditoria: 2026-11-26
Branch: `shiqi-parallel-dev`
Escopo: preparação isolada; nenhuma alteração no projeto original, em `main` ou em produção.

## Decisão de escopo: música

O usuário desistiu da funcionalidade de música. Excluir música do escopo do produto, schema alvo, testes e migração. A migration incompleta 0011 pode permanecer no repositório apenas como registro histórico, mas nunca deve ser aplicada. Não é necessário recuperar seu SQL. A remoção de referências/UI será feita somente na cópia paralela e preservando o restante da interface original.

## Decisão de segurança

**Não aplicar em lote as migrations copiadas e não publicar a Edge Function de autenticação neste estado.**
O banco paralelo contém um schema mínimo de comunidades/chat que não é equivalente ao schema exigido pelo aplicativo original. A migração incremental deve ser precedida por uma reconstrução e comparação de contratos, sem apagar ou renomear tabelas existentes.

## Constatações confirmadas

1. O Supabase paralelo `ujdosskjycrdkcgsswfa` está ativo, mas contém somente as tabelas públicas `profiles`, `communities`, `community_members`, `channels` e `messages`. As cinco têm RLS habilitado.
2. O histórico remoto do banco paralelo contém cinco migrations de bootstrap/hardening, não a sequência original 0001–0025.
3. Não há Edge Functions publicadas no projeto Supabase paralelo.
4. A migration original `0002_chat_e_perfil.sql` pressupõe que uma migration anterior chamada `servidores_e_canais` já tenha criado `servers`, `server_members`, `channels`, `create_server` e `is_server_member`. Essa migration-base não está no diretório versionado; o próprio arquivo 0002 só a descreve em comentário.
5. O schema atual paralelo de `profiles` não é compatível com a definição da migration original 0001: campos obrigatórios e nomes/tipos diferem. A tabela `channels` também usa `community_id/channel_type`, enquanto o app original espera `server_id/kind`. Não tentar corrigir com renames ou drops sem um plano de compatibilidade.
6. A Edge Function `supabase/functions/auth/index.ts` no branch paralelo é um stub de aproximadamente 50 linhas e termina após declarar a expressão de validação de e-mail. Não contém servidor HTTP, roteamento, handlers ou `Deno.serve`.
7. **A fonte correspondente em `main` também é o mesmo stub incompleto** (com fallback de chave publicável e URL antigas). Portanto, não existe uma implementação completa dessa função no Git versionado que possa simplesmente ser copiada. As rotas descritas no cabeçalho e chamadas pelo frontend não estão implementadas nesse arquivo.
8. O frontend original chama endpoints de cadastro/login e também depende de fluxos de verificação, reenvio de e-mail, TOTP, QR e recuperação de senha; os contratos iniciais estão em `docs/AUTH_CONTRACT_INVENTORY.md`.
9. A migration `0025_voz_10_participantes.sql` depende de colunas `muted`, `deafened`, `video` e `screen` adicionadas em `0023_estado_da_chamada.sql`. A sequência 0023 antes de 0025 é requisito. A migration 0025 não foi aplicada no banco paralelo.
10. A migration 0021 (eventos) é um resumo, não implementação completa. A migration 0011 (música) também é um resumo, mas música foi retirada do escopo pelo usuário e sua recuperação não é necessária.
11. A auditoria de segurança do Supabase paralelo não retornou findings na consulta desta data. Isso não substitui testes funcionais, revisão das policies nem validação do schema.

## Restrições preservadas

- Não tocar no projeto Supabase original nem no Supabase `ocfmaogjjvlqhueywrnz`.
- Não alterar `main`, `site/`, `desktop/`, domínio principal ou produção.
- Não substituir design, telas, componentes, fluxos ou regras de negócio, exceto a retirada da funcionalidade de música expressamente autorizada pelo usuário.
- Não colocar `service_role`, segredos Resend ou outras credenciais privadas no navegador ou no Git.
- Não criar contas ou enviar e-mails sem preparação do fluxo e autorização específica.
- Não aplicar migrations remotas enquanto schema, RLS, grants e dependências não forem comprovados.
- Não executar o teste de voz com 10 participantes novamente, conforme instrução do usuário.
- Não tentar contornar a janela de limite da Vercel para Preview.

## Próximas ações

1. Completar inventário de campos/operações e recuperar SQL ausente do schema base e eventos por fonte autorizada.
2. Reconstruir auth com contratos explícitos e testes; o código versionado original é stub, não implementação funcional.
3. Validar JWT do Supabase, ampliar testes e só depois integrar middleware Rust.
4. Criar migrations incrementais compatíveis no projeto paralelo, sem apagar dados/objetos existentes e excluindo música.
5. Executar regressão dos fluxos que permanecem no produto.
6. Publicar Preview somente quando a limitação da Vercel permitir e houver autorização operacional.

## Estado desta auditoria

Nenhuma migration foi aplicada nesta etapa; nenhuma Edge Function foi publicada; nenhuma alteração foi feita no app original ou em produção.