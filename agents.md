# agents.md — Manual permanente da IA

Estas regras valem para **qualquer IA** que trabalhe neste projeto (Claude ou outra), em qualquer conta ou sessão. Elas não mudam de uma conversa para outra. O estado atual do projeto fica em `task.md`.

A pessoa que está construindo este projeto é **iniciante**. Escreva e explique tudo em **português do Brasil**, de forma simples.

---

## 1. Ao começar uma sessão

1. **Leia o `task.md` inteiro antes de fazer qualquer coisa.** Ele diz o que o projeto é, o que já está pronto, o que está em andamento e qual é o próximo passo.
2. **Analise o código existente antes de modificá-lo.** Abra e leia os arquivos que vai mexer (e os que dependem deles). Nunca altere um arquivo "de memória" ou por suposição.
3. **Não recrie funcionalidades que já estão funcionando.** Se algo consta como concluído no `task.md`, não refaça: só mexa se a pessoa pedir ou se houver um erro registrado.

## 2. Durante o trabalho

4. **Não apague arquivos sem necessidade.** Se apagar ou mover algo, diga qual arquivo e por quê. Na dúvida, não apague.
5. **Se houver erros, explique em linguagem simples.** Diga: o que aconteceu, por que aconteceu, o que você fez (ou o que a pessoa precisa fazer). Evite jargão; quando precisar de um termo técnico, explique-o em uma frase.
6. **É lei: atualize o `task.md` automaticamente, em tempo real.**
   - Ao **começar** uma tarefa: mova-a para "Em andamento agora".
   - Ao **concluir** uma tarefa: mova-a para "Concluído", com a data.
   - Ao **alterar** uma tarefa (mudou o escopo, foi dividida, cancelada): atualize a linha dela.
   - Ao **descobrir um erro**: registre em "Erros a corrigir"; ao corrigir, tire de lá.
   - Ao **surgir algo novo** a fazer: adicione em "O que ainda falta fazer".
   - Antes de adicionar uma tarefa, **procure se ela já existe** no arquivo, para não duplicar nem refazer o que já está feito.
   - Não deixe a atualização para o final: faça no momento em que acontece.
8. **Envie ao GitHub a cada tarefa concluída.** Depois de concluir uma tarefa (e atualizar o `task.md`), faça `git add -A`, `git commit` e `git push origin main`, sem esperar a pessoa pedir. Assim, se o limite da conta acabar, nada fica preso na sessão e outra conta continua de onde parou. Nunca envie segredos (veja "Regras do projeto"). Se o envio falhar, avise a pessoa em linguagem simples.

## 3. Ao encerrar uma sessão

7. **Antes de encerrar (ou se a pessoa disser que vai trocar de conta), envie tudo ao GitHub e registre no `task.md`**, na seção "Registro de sessões": o que foi feito, os problemas encontrados e o próximo passo. Confira também se "Em andamento agora" e "Próximo passo" estão corretos para a próxima IA.

## Trabalho em dupla (Claude + ChatGPT)

> **Regra máxima (decisão da pessoa, 2026-11-26): o design, o layout e a identidade visual da plataforma são INTOCÁVEIS.** Nenhuma IA muda cores, espaçamentos, telas, textos, ícones, animações, navegação ou fluxos. O trabalho paralelo existe para **somar**: levar o **Rust** para a plataforma (mais fluida, leve e rápida) e trazer melhorias, **sem a pessoa perceber diferença no visual**. Se uma melhoria exigir mexer em algo visível, ela só vale com ordem expressa da pessoa.
>
> **Quem manda nestes dois arquivos:** o `agents.md` e o `task.md` da raiz (`main`) são a autoridade do projeto e são mantidos pelo Claude. O ChatGPT segue as regras daqui e registra o trabalho dele no `shiqi-parallel/task.md`; se os dois arquivos divergirem, vale o da raiz.

Desde 2026-11-26 o projeto é feito por **duas IAs lado a lado**. Valem para as duas:

1. **Cada uma na sua pista.** `main` = produto no ar (site da Vercel `square-chat`, Supabase `vjkqyqdabypdylhoupha`, domínio shiqi.com.br): quem mexe é o Claude. `shiqi-parallel-dev` = trabalho paralelo do ChatGPT, só dentro de `shiqi-parallel/` (Vercel `shiqi-parallel` e Supabase `ujdosskjycrdkcgsswfa` próprios). Uma IA **nunca** altera a pista da outra sem a pessoa pedir.
2. **Nada entra na `main` sem a pessoa autorizar.** Antes de juntar trabalho da outra IA: ler o que muda (`git diff --stat main...<branch>`), rodar `node tests/smoke.js`, conferir que nenhum arquivo ficou cortado (tamanho e `git diff --stat` sem apagar linhas à toa) e só então fazer o merge, com a pessoa de acordo.
3. **Design congelado:** o `site/` e o `design/` são a referência visual. O que vier da branch paralela precisa ficar **idêntico** na tela (conferido lado a lado com o original antes de qualquer merge). Só se remove ou simplifica algo com ordem expressa da pessoa.
4. **Tudo vai para o `task.md`.** Quem mexeu registra o quê, onde e o próximo passo (e qual IA fez). Antes de começar, leia o `task.md` **e** o `shiqi-parallel/task.md`.
5. **Nada de segredos** nos arquivos, nem de acesso cruzado: cada IA usa só as chaves e o banco do seu lado.
6. **Se algo da outra IA parecer errado, avise a pessoa** em português simples, em vez de consertar por cima em silêncio.

---

## Regras do projeto

- **Segredos nunca entram em arquivos do projeto.** Chaves como `RESEND_API_KEY` ficam nos segredos do Supabase, nunca no código nem no GitHub. (A chave *publicável* do Supabase em `site/config.js` é pública por design e pode ficar.)
- **Não existe etapa de build no site.** Ele é HTML, CSS e JavaScript puros em `site/`. Não adicione frameworks ou ferramentas de build sem a pessoa pedir.
- **Testes:** depois de mudar o site, rode `node tests/smoke.js` (precisa do Playwright) e confira que tudo passa antes de publicar.
- **Texto na tela e mensagens de erro para o usuário final:** sempre em português do Brasil.
- **Publicação:** o site vai para a Vercel (projeto `square-chat`); o backend vai para o Supabase (função `auth`). Depois de publicar, confira no ar e registre no `task.md`.
