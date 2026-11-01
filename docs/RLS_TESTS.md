# Testes de RLS em ambiente Supabase de teste

Use um projeto **de teste** com a migration inicial aplicada e duas contas de teste já criadas. Não execute no projeto remoto de produção. O teste deve usar a chave pública anon e tokens reais de cada usuário, nunca a service role, pois ela ignora RLS.

1. Sem sessão, consulte `profiles`, `channels`, `messages` e `notifications`. Cada consulta deve retornar zero linhas ou erro de autorização. Tente inserir uma mensagem; deve falhar.
2. Autentique a conta A. Consulte `channels`; espere exatamente `geral`, `desenvolvimento` e `compartilhamentos`. Insira mensagem válida com `author_id` da conta A; deve funcionar.
3. Ainda como A, tente inserir mensagem com `author_id` da conta B, canal inexistente, conteúdo vazio, apenas espaços e mais de 2000 caracteres. Todas devem falhar.
4. Consulte as mensagens de cada canal como A e B. A mensagem válida aparece apenas no canal escolhido. Verifique que a consulta paginada usa `created_at desc, id desc` e retorna a próxima página sem lacunas nem duplicatas.
5. Envie uma mensagem como B enquanto A está em outro canal. Consulte `notifications` como A: deve haver uma notificação única para a mensagem de B. Como B, não deve haver notificação da própria mensagem. Tente ler/atualizar a notificação de A com o token de B; não deve revelar nem alterar a linha.
6. Marque a notificação como lida com token de A e confirme que o estado persiste após nova consulta. Abra outra sessão de A e confira a sincronização.
7. Desative A **somente no ambiente de teste** (`profiles.active = false` por operação administrativa). Com a sessão antiga, novas consultas e inserções devem ser negadas. Reconecte o Realtime e confirme que não recebe novas alterações. A revogação de um websocket já conectado pode durar até a renovação/expiração do JWT; não trate RLS de Postgres como desconexão instantânea.

Registre para cada caso o status HTTP, o resultado esperado e o real. A ausência desse relatório significa que RLS ainda não foi validado em execução.
