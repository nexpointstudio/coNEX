# coNEX V1.0 — estado da release candidate local

Data da revisão: 2026-10-31. O commit local `f8f2a09` coincidia com `origin/main` no início desta revisão; havia uma alteração local pré-existente em `supabase/functions/account/index.ts`, preservada e complementada.

| Recurso | Estado | Evidência ou pendência |
| --- | --- | --- |
| Build, tipos, lint, manifesto e service worker | Validado localmente | `npm.cmd run build` e `npm.cmd run lint` passaram; `dist` contém manifesto e `sw.js`. |
| Layout de login desktop/mobile | Validado localmente | Browser headless em 1366, 390 e 320 px: sem overflow horizontal ou erros JavaScript; service worker registrado. |
| Regras puras de usuário, senha, mensagem, notificações e sessão | Validado localmente | 9 testes Node passaram. |
| Cadastro público, login e logout com Supabase | Implementado mas não testado em integração | Exige Secrets, Turnstile e duas contas de teste. A função não foi implantada nesta revisão. |
| RLS e autorização | Implementado mas não testado em execução | Migration inicial já existente; roteiro em `docs/RLS_TESTS.md`. Nenhum SQL remoto foi executado. |
| Chat, histórico, Realtime e notificações entre duas contas | Implementado mas não testado em integração | Exige duas sessões reais em redes/dispositivos diferentes. |
| PWA instalada e atualização após novo deploy | Pendente | Registro local verificado; instalação e ciclo de atualização real dependem de HTTPS e novo deploy. |
| Cloudflare Pages | Preparado, publicação pendente | Configuração e passos em `docs/DEPLOY.md`; sem push ou deploy. |

## Riscos e limites

- `npm.cmd audit`: 10 avisos (2 baixos, 8 moderados), todos na cadeia de desenvolvimento do Workbox/`vite-plugin-pwa`. `npm.cmd audit --omit=dev`: 0. A correção sugerida pelo audit altera a versão do plugin; não foi aplicada sem validar compatibilidade da PWA.
- O Gmail base controla os aliases de todas as contas. O recebimento em alias e o fluxo de Auth com o projeto real ainda precisam de teste. Não habilitar recuperação pública por e-mail sem revisar a segurança do modelo.
- Com cadastro aberto, a proteção depende de Turnstile, limite por nome, limite global e controles de borda/Supabase. A função falha fechada se Turnstile ou o Gmail base não estiverem configurados. O limite global pode bloquear cadastros legítimos após atingir a quota.
- O token de sessão fica em armazenamento do navegador conforme a escolha do usuário. Scripts injetados na origem poderiam lê-lo. `public/_headers` inclui CSP para o domínio padrão do Supabase e Turnstile; valide o cabeçalho no Pages e ajuste-o se usar domínio Supabase personalizado.
- A revogação de um usuário desativado pode demorar até a renovação do JWT para uma conexão Realtime já aberta; novas consultas ao banco são bloqueadas por RLS.
- O cache da PWA contém a interface, não o histórico de mensagens. Studio, Social, voz, vídeo, anexos e push não são parte da V1.
