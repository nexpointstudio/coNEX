# coNEX V1.0

PWA React/Vite para um espaço privado com três canais de texto. Sem configuração do Supabase, a aplicação mostra somente uma prévia local, claramente identificada e sem envio de mensagens.

## Desenvolvimento local

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Preencha `.env.local` com URL e chave **pública** anon do projeto Supabase. Não coloque a service role em arquivo `VITE_*` nem no frontend. `.env.local` é ignorado pelo Git. Para build: `npm.cmd run build`; para servir o build da PWA: `npm.cmd run preview -- --host 127.0.0.1`.

## Configuração Supabase pendente

Nenhuma configuração remota é feita automaticamente por este repositório.

1. Crie um projeto Supabase próprio. Desabilite cadastro público por e-mail em Authentication. Permita login por senha; o e-mail técnico é criado apenas pela função administrativa. Configure limites de rate no Auth e proteção de infraestrutura/WAF para o endpoint de conta.
2. Aplique `supabase/migrations/202610310001_conex_v1.sql` em um ambiente de teste e depois no ambiente escolhido. Verifique a publicação Realtime de `messages` e `notifications`. Execute testes RLS com contas reais antes da publicação.
3. Faça deploy da Edge Function `account` com `verify_jwt = false`, necessário para login/cadastro antes de existir uma sessão. Defina o segredo `APP_ORIGINS` como lista de origens web permitidas separadas por vírgula (por exemplo, `https://seu-dominio.example,http://localhost:5173`). O runtime da função deve receber `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` pelo ambiente seguro do Supabase, nunca pelo navegador.
4. Configure URL de site, domínios HTTPS e chaves públicas no arquivo local `.env.local`. Para uso em dispositivos diferentes, publique em uma origem HTTPS acessível; localhost só serve no PC atual.

### Gerar convite de uso único

Execute a consulta abaixo **somente** no SQL Editor administrativo. Copie o token resultante para o destinatário em canal privado e monte o link `https://seu-dominio.example/?invite=TOKEN`. O token puro aparece uma única vez na saída desta consulta; o banco armazena somente seu SHA-256. Mude `interval '48 hours'` para a validade desejada. Não registre o link em logs ou analytics.

```sql
with secret as (select encode(gen_random_bytes(32), 'hex') as token),
created as (
  insert into public.invites (token_hash, expires_at)
  select encode(extensions.digest(token, 'sha256'), 'hex'), now() + interval '48 hours'
  from secret
  returning id
)
select secret.token, created.id from secret cross join created;
```

O cadastro recebe o token pelo link, valida formato, validade e uso único no servidor; a senha fica apenas no Supabase Auth. Nomes são únicos sem diferenciar maiúsculas/minúsculas. Quando um usuário esquece a senha, um administrador deve verificar sua identidade fora da aplicação e redefinir pelo painel seguro do Supabase Auth, comunicando uma senha temporária por canal apropriado. A V1 não oferece recuperação automática por e-mail.

### Testar com duas contas

Gere dois convites distintos. Crie duas contas em navegadores/perfis separados, acesse a mesma origem HTTPS em redes diferentes e entre com nome e senha. Envie uma mensagem em cada canal, confira autoria, persistência após recarga, recebimento Realtime e notificações em canal não selecionado. Teste marcar como lida, logout e a opção de manter conectado fechando e reabrindo o navegador. Desmarcada, a sessão fica em `sessionStorage`, limitada à aba/sessão do navegador.

### Segurança e limites

RLS protege perfis, canais, mensagens e notificações. Visitantes anônimos não têm acesso às tabelas privadas. O backend valida nome, senha, convite e conteúdo; o banco valida autor, tamanho e canal. A função limita tentativas por nome de usuário, mas proteção contra ataques distribuídos requer limites adicionais no Supabase e na borda. O endereço de e-mail técnico não é um canal de recuperação. A função de cadastro executa criação no Auth e gravações no banco em etapas, com limpeza compensatória se falhar; uma interrupção abrupta pode exigir revisão administrativa de conta incompleta.

Notificações são internas; não há push. Studio, Social, anexos e voz estão indisponíveis. A PWA atualiza o service worker após aviso e ação do usuário; mensagens ainda no campo de edição bloqueiam o botão de atualização. O cache offline é da interface, não do histórico privado. Um aplicativo Electron e seu mecanismo de atualização ficam para outra etapa.
