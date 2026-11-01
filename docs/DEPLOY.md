# Publicação manual do coNEX V1.0

Nenhum passo deste documento foi executado automaticamente. Preserve o projeto Supabase existente e faça backup antes de ajustes remotos. Não reaplique `202610310001_conex_v1.sql`.

## 1. Revisão local

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd audit
npm.cmd audit --omit=dev
git status --short
```

Revise as diferenças locais antes de fazer commit ou push manual ao repositório `https://github.com/nexpointstudio/coNEX`. O Cloudflare Pages só verá o que estiver no repositório remoto.

## 2. Supabase

1. Confirme as tabelas `profiles`, `channels`, `messages`, `notifications` e `account_attempts`, as políticas RLS, a função `check_account_rate` e a publicação Realtime. `invites` é legado.
2. Em Authentication, mantenha o provedor de e-mail/senha habilitado, mas desabilite cadastro direto via Auth. A criação fica exclusivamente na função administrativa. Confira a política mínima de senha do Supabase: ela precisa aceitar 8 caracteres. Revise opções de recuperação e troca de e-mail, pois um Gmail controla os aliases técnicos.
3. Crie um widget gratuito Cloudflare Turnstile para `localhost`. Após receber o endereço do Pages, adicione o hostname exato `seu-projeto.pages.dev` ao widget; o campo de hostname não aceita `*`. Guarde site key (pública) e secret key (servidor).
4. Configure Secrets da função `account`: `APP_ORIGINS` com origens exatas, por exemplo `http://localhost:5173,https://seu-projeto.pages.dev`; `ACCOUNT_EMAIL_BASE` com o Gmail que você controla; `ALLOW_PUBLIC_SIGNUP=false` inicialmente; `TURNSTILE_SECRET_KEY` com a chave secreta do widget. Confirme também `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente seguro da função. Nunca os copie para o frontend.
5. Após revisar o código e testar em ambiente de teste, atualize manualmente a Edge Function: `supabase functions deploy account --project-ref SEU_PROJECT_REF --no-verify-jwt`. O arquivo `supabase/config.toml` também registra `verify_jwt = false` para esta função, que recebe requisições antes do login. Não faça deploy ou alteração de Secrets sem autorização.
6. Para abrir cadastros, altere `ALLOW_PUBLIC_SIGNUP` para `true` no ambiente seguro da função e confirme que o widget funciona no domínio. Para fechar, volte a `false`. O frontend pode continuar exibindo a aba de cadastro; o servidor é a autoridade.

O alias `+conex-<identificador>@gmail.com` segue o formato de aliases documentado pelo Gmail e pode ser fornecido à API administrativa do Supabase Auth. A compatibilidade ponta a ponta no projeto real e o recebimento de mensagens nesse alias ainda não foram confirmados.

## 3. Cloudflare Pages

1. Entre em **Workers & Pages > Create > Pages > Connect to Git** e selecione `nexpointstudio/coNEX`, na branch de produção desejada.
2. Use preset **React (Vite)**, comando de build `npm run build`, saída `dist`, raiz do projeto. Defina Node.js 24 se o ambiente escolher versão incompatível.
3. Configure as variáveis de build públicas `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_TURNSTILE_SITE_KEY`. Não configure service role, Gmail base nem Turnstile secret no Pages.
4. O plano gratuito fornece subdomínio `pages.dev` e não exige compra de domínio. Antes de abrir cadastro, adicione a URL HTTPS publicada a `APP_ORIGINS` e o hostname ao widget Turnstile. Configure Site URL e Redirect URLs pertinentes no Supabase Auth.
5. O Pages trata a aplicação como SPA quando não há `404.html` no topo. `public/_headers` define cabeçalhos básicos; `sw.js` e manifesto não recebem cache duradouro, enquanto assets versionados usam cache imutável.
6. No domínio publicado, confirme carregamento, login, logout, instalação da PWA, service worker, atualização após novo deploy e navegação desktop/celular. Teste duas contas reais em redes distintas antes de declarar o chat online validado.

O service worker precacheia a interface. Mudanças de versão aparecem no aviso `Nova versão do coNEX disponível`; o usuário aciona `Atualizar agora`. Um rascunho não enviado impede essa ação. Não há push externo nem atualizador Electron.

## Fontes de configuração

- [Cloudflare Pages: build React/Vite](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages: SPA](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Cloudflare Pages: headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Cloudflare Pages: limites do plano gratuito](https://developers.cloudflare.com/pages/platform/limits/)
- [Supabase: criação administrativa de usuários](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Supabase: autenticação e Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Cloudflare Turnstile: validação no servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
