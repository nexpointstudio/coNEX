# coNEX V1.0

Aplicação React, TypeScript e Vite para chat privado em três canais. O frontend usa Supabase Auth, PostgreSQL e Realtime. Sem variáveis Supabase, mostra apenas uma prévia local sem envio.

## Requisitos e execução local

- Node.js 24 e npm 11 (versões usadas neste projeto)
- Projeto Supabase existente, com a migration inicial já aplicada
- Widget gratuito Cloudflare Turnstile para cadastro público

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Preencha `.env.local` apenas com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (chave pública) e `VITE_TURNSTILE_SITE_KEY` (chave pública). O arquivo é ignorado pelo Git. Nunca use service role ou `TURNSTILE_SECRET_KEY` em variáveis `VITE_`.

## Contas

Cadastro pede nome único e senha de 8 a 128 caracteres, sem convite. `ALLOW_PUBLIC_SIGNUP` controla a Edge Function: somente o texto exato `true` permite cadastro; `false`, valor ausente ou outro valor bloqueia. O cadastro aberto exige um token Turnstile válido; a função verifica token e hostname com a API Siteverify antes de criar o usuário. CORS restringe navegadores, mas não autentica o solicitante. Há limite por nome e limite global de 6 solicitações válidas por hora; considere também proteção contra abuso no Supabase e Cloudflare. O limite global pode afetar usuários legítimos se muitas contas forem abertas na mesma hora.

`ACCOUNT_EMAIL_BASE` é o endereço Gmail controlado pela NexPoint, enviado **somente como Secret da função**. A função gera um alias `+conex-` com identificador aleatório para cada conta e usa a API administrativa do Supabase Auth com `email_confirm: true`. Assim, o cadastro não precisa receber e-mail. O recebimento em aliases Gmail ainda precisa de teste e os aliases não provam identidade individual; o proprietário do Gmail controla a recuperação de todas as contas. Não habilite fluxo público de redefinição por e-mail sem revisar esse modelo. Em caso de perda da senha, o administrador deve verificar a pessoa fora da aplicação e redefinir a conta pelo painel seguro do Supabase.

A função necessita dos Secrets `APP_ORIGINS` (origens exatas separadas por vírgula), `ACCOUNT_EMAIL_BASE`, `ALLOW_PUBLIC_SIGNUP` e `TURNSTILE_SECRET_KEY`. `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos ao runtime Supabase ou devem ser configurados exclusivamente no servidor. O login usa nome e senha; `Manter conectado` escolhe entre `localStorage` e `sessionStorage`. O logout usa Supabase Auth.

## Banco e segurança

A migration `supabase/migrations/202610310001_conex_v1.sql` **já foi aplicada** no projeto remoto informado; não a reaplique. Ela cria perfis, canais, mensagens, notificações, limite de tentativas e a tabela legada `invites` (não usada no cadastro atual). RLS permite leitura de mensagens apenas a membros ativos, inserção apenas pelo próprio autor, e leitura/atualização de notificações apenas pelo titular. Os limites de conteúdo, índices de paginação e três canais estão definidos no banco. Testes de RLS exigem um ambiente Supabase de teste e duas contas; veja [docs/RLS_TESTS.md](docs/RLS_TESTS.md). Não execute esses testes no projeto remoto de produção.

Para testar duas contas, use perfis de navegador separados e duas redes/dispositivos após configurar uma origem HTTPS. Crie as contas quando o cadastro estiver aberto, feche o cadastro, faça login, envie mensagens nos três canais e confirme histórico após recarga, notificações, reconexão, logout e as duas opções de persistência. Sem esse teste real não há evidência de funcionamento entre redes.

## PWA e publicação

`npm.cmd run build` gera `dist`, incluindo manifesto, ícones e service worker. A interface pode ser instalada como PWA onde o navegador oferecer instalação. O aviso de nova versão oferece `Atualizar agora` e bloqueia atualização enquanto houver texto não enviado. O cache prévio contém arquivos da interface, não respostas de chat. Consulte [docs/DEPLOY.md](docs/DEPLOY.md) para atualizar a função e publicar manualmente no Cloudflare Pages, sem domínio pago obrigatório.

Studio, Social, voz, vídeo, anexos, push e Electron ficam para versões posteriores. A validação online da Edge Function, RLS, chat e PWA instalada depende da configuração externa e de testes reais.
