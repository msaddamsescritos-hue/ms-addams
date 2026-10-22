# Clube das Entrelinhas — ativação segura

Implementação no repositório da Ms. Addams. **Não apague o banco atual.** Inscrições e avisos permanecem desligados até que o backend seja ativado.

## 1. Banco de dados
No projeto Supabase correto, abra **SQL Editor > New query** e execute todo o conteúdo de `db/clube-leitores.sql`.

Esse SQL cria:
- `club_subscribers` com status pendente, confirmado e cancelado;
- `club_notification_sends` para impedir aviso duplicado por capítulo;
- políticas RLS que restringem a consulta dos inscritos à autora;
- função do servidor `club_claim_notification_batch`.

Não modifica nem exclui capítulos, cartas ou estatísticas existentes.

## 2. E-mail autorizado
Configure um remetente válido e verificado num serviço de envio compatível com a API da Resend.

Configure **somente nas variáveis secretas das Edge Functions do Supabase** (nunca em `docs/assets/config.js`, GitHub público ou conversa):

- `RESEND_API_KEY`: chave privada do provedor de e-mail.
- `CLUB_MAIL_FROM`: remetente autorizado, por exemplo, uma caixa no domínio verificado.
- `CLUB_LINK_SECRET`: valor aleatório privado com ao menos 32 caracteres, de preferência um segredo hexadecimal gerado com gerador criptograficamente seguro.
- `TURNSTILE_SECRET_KEY`: a chave secreta do Cloudflare Turnstile do domínio (não a site key pública).

O Supabase já fornece as variáveis internas `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` na maioria dos projetos; verifique no ambiente antes de publicar.

**Não use o e-mail Gmail da autora como `CLUB_MAIL_FROM` a menos que o provedor confirme expressamente que ele pode ser utilizado e autenticado.**

## 3. Edge Functions
Publique as funções abaixo no projeto Supabase correto, preservando a importação da pasta compartilhada `supabase/functions/_shared`:
- `club-request`: solicita inscrição ou cancelamento, protegida por Turnstile, envia link por e-mail.
- `club-action`: valida o token temporário de confirmação ou o link assinado de cancelamento.
- `club-notify`: exige a sessão real de administradora, restringe-se a capítulos publicados e envia no máximo dez avisos por clique.

O arquivo `supabase/config.toml` já declara `verify_jwt = false` para essas rotas, pois a rota administrativa `club-notify` valida explicitamente o token e a autorização da administradora dentro da função. A chave de serviço jamais é exposta ao navegador.

## 4. Ativar o formulário público
Somente depois de banco, segredos, funções e remetente estarem funcionando:

Em `docs/assets/config.js`, altere **somente** `clubEnabled: false` para `clubEnabled: true`, salve no GitHub e aguarde a publicação no GitHub Pages.

Até esse momento, o formulário público aparece como **inscrições em preparação** e não envia inscrições falsas.

## 5. Teste sem disparar mensagens a terceiros
1. Inscreva **um endereço de teste de sua propriedade** em msaddams.com.
2. Abra o e-mail de confirmação; clique no link e depois no botão **Confirmar minha entrada**.
3. Abra o gabinete e clique em **Clube de Leitores**: o cadastro deve aparecer como **Confirmado**.
4. No gabinete, em **Notícias de novos manuscritos**, selecione um capítulo público e clique **Conferir destinatários**. Isso não envia e-mail.
5. Somente se desejar enviar um aviso verdadeiro, clique em **Enviar próximos 10 avisos** e confirme o diálogo. Cada leitor confirmado receberá no máximo um aviso por capítulo.
6. Confirme o cancelamento de inscrição com o link recebido; veja a mudança no gabinete. Reinscrição exige nova confirmação.

## Segurança, limites e transparência
- O pseudônimo é opcional. Inscrever-se não significa enviar uma carta à autora.
- O token de confirmação expira em 24 horas, fica protegido por hash no banco e só pode ser usado uma vez.
- Clicar num link abre uma página de confirmação explícita; scanners de e-mail não devem confirmar ou cancelar automaticamente.
- Inscrições canceladas não são incluídas em novos avisos.
- Falhas de envio não são reenviadas automaticamente; verifique o provedor antes de reiniciar uma campanha.
- A entrega e os limites dependem da configuração e do plano do provedor.
- O envio de avisos é manual e consciente, não automático ao publicar capítulos.
- A política de privacidade deve ser revisada quanto ao canal de solicitações e prazo de retenção.
