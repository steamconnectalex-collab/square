# Arquitetura — SHIQI paralela

## Auditoria do projeto de referência
A versão atual do repositório usa HTML/CSS/JavaScript sem build no site, Supabase (PostgreSQL, Auth/Edge Functions e Realtime), Resend para e-mail e Electron para desktop. Há um histórico extenso de migrações e regras de segurança. Isso é referência funcional, não autorização para copiar dados ou credenciais.

## Decisão inicial
1. Manter a primeira interface em HTML/CSS/JavaScript puro para validar a experiência sem adicionar complexidade.
2. Manter todo o código novo sob `shiqi-parallel/`.
3. Criar serviços separados para a SHIQI quando a necessidade estiver definida:
   - Supabase novo para autenticação, banco, storage e políticas RLS.
   - Resend com chave própria e acesso mínimo de envio.
   - Vercel com projeto separado e Root Directory `shiqi-parallel/apps/web`.
4. Não reutilizar o projeto Vercel `square-chat`, o projeto Supabase existente, chaves publicáveis/secretas, nem credenciais Resend da versão de referência.
5. Não adotar Rust por antecipação. Primeiro medir os requisitos de presença, mensagens e chamadas; se WebSocket persistente exigir serviço dedicado, avaliar Rust/Tokio/Axum como serviço independente.

## Segurança e publicação
- Nenhum segredo no Git ou no navegador.
- RLS em todas as tabelas expostas; políticas por usuário/membro e testes negativos.
- Ambientes de Preview separados; nenhuma publicação em produção ou domínio principal nesta etapa.
- Excluir a pasta não remove recursos externos. Vercel, Supabase, Resend e domínios deverão ser excluídos/desconectados separadamente se o projeto for abandonado.

## Base de dados criada
- `profiles`: perfil público vinculado a `auth.users`, com username e nome de exibição.
- `communities`: espaços com proprietário e slug.
- `community_members`: membros e papéis owner/admin/member; criação de comunidade insere o proprietário automaticamente.
- `channels`: canais textuais e de voz por comunidade.
- `messages`: mensagens em canais, com autor e timestamps.
- Todas as tabelas públicas acima têm RLS habilitado. Helpers de autorização vivem no schema `private`, fora da API exposta.
- O signup cria o perfil por trigger no banco; o frontend nunca recebe chave `service_role`.

## Próximas decisões
- Confirmar organização e custo antes de criar um projeto Supabase.
- Confirmar o domínio/remetente que será usado no ambiente de testes antes de configurar e-mail.
- Definir o primeiro fluxo funcional (conta, comunidade, canais e mensagens) após validar a base visual.
