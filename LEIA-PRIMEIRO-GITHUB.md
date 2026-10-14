# MS. ADDAMS — versão GitHub Pages

O **GitHub Pages** hospeda as páginas públicas. Para a biblioteca com editor, login e cartas de leitores funcionarem de verdade, também é necessário configurar **Supabase (Auth, tabelas e Edge Functions)** e **Resend (remetente de resposta)**. Não usamos a Netlify nesta versão.

## Parte 1 — Colocar a aparência do site no ar pelo GitHub

1. No computador, descompacte o ZIP. Abra a pasta `MS_ADDAMS_GITHUB_PAGES`.
2. Em https://github.com, entre na sua conta e clique em **New repository**.
3. Nome sugerido: `ms-addams`. Se quiser GitHub Pages no plano gratuito, selecione **Public**. Todos os arquivos de um repositório público ficam visíveis para terceiros, portanto não inclua nome real, senha, tokens, e-mails privados ou rascunhos pessoais.
4. Clique em **Create repository**.
5. Na página do repositório, clique em **uploading an existing file** e envie os arquivos e pastas **da raiz do pacote extraído**, incluindo `docs`, `db`, `supabase`, `LEIA-PRIMEIRO-GITHUB.md`. Não envie o próprio ZIP.
6. Clique em **Commit changes**.
7. Abra **Settings → Pages → Build and deployment**, escolha **Deploy from a branch**, selecione **main** e a pasta **/docs**, clique **Save**.
8. Aguarde a publicação; o endereço será algo como `https://USUARIO.github.io/ms-addams/`.
9. Nessa etapa a identidade visual e o capítulo de demonstração aparecem, mas a correspondência e o login ainda **não estão ativados**.

## Parte 2 — Ativar capítulos e login

1. Crie um projeto em https://supabase.com. Não use uma senha que já utiliza em outros sites.
2. Em **SQL Editor**, execute o conteúdo de `db/schema.sql`.
3. Em **Authentication → Users**, crie o usuário que administrará os capítulos. Copie seu UUID. Execute em SQL Editor (substitua pelo UUID real):

```sql
insert into public.site_admins(user_id) values ('COLE-AQUI-SEU-UUID');
```

4. No Supabase, copie a **Project URL** e a chave **publishable/anon (pública)**. No GitHub, edite `docs/assets/config.js` e preencha apenas os campos `supabaseUrl` e `supabasePublishableKey`. Essas duas informações podem ficar no JavaScript público — jamais coloque `service_role`, `secret key`, senha ou chave do Resend neste arquivo.
5. Após o GitHub Pages atualizar, abra `/painel/` na URL do site e entre com seu usuário e senha. O capítulo 1 estará salvo como **rascunho** no Supabase. Cole o texto integral e publique pelo painel.

## Parte 3 — Ativar envio e resposta às cartas

As funções do servidor estão em `supabase/functions/` (não são executadas pelo GitHub Pages). Para colocá-las no ar, é preciso fazer o deploy no seu projeto Supabase. Uma forma é instalar o Supabase CLI (veja a documentação do Supabase) e, na raiz deste projeto, executar:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy contact
supabase functions deploy reply
supabase functions deploy delete-letter
```

O arquivo `supabase/config.toml` desativa a checagem automática de JWT para as funções. **Não remove a proteção do painel**: as funções `reply` e `delete-letter` verificam a sessão e a permissão administrativa dentro do código.

Para evitar spam, configure o Cloudflare Turnstile: coloque a **site key pública** em `docs/assets/config.js` e registre `TURNSTILE_SECRET_KEY` como segredo da função. Para a resposta por e-mail, crie uma conta no Resend e verifique um domínio de envio. Em **Supabase → Edge Functions → Secrets**, registre `RESEND_API_KEY`, `MAIL_FROM` (ex.: `Ms. Addams <cartas@dominioverificado.com.br>`) e, opcionalmente, `MAIL_REPLY_TO`. O Resend exige um remetente válido e verificado; o endereço não é ocultável para quem recebe o e-mail.

**Importante:** não abra a seção de cartas ao público antes de definir o canal de privacidade, retenção das mensagens e proteção contra abuso. O site contém um modelo de política de privacidade, que deve ser revisado para o seu caso.

## Privacidade e direitos autorais

As páginas públicas exibem apenas “Ms. Addams”. Essa assinatura não impede que provedores de domínio, hospedagem, banco de dados ou e-mail conheçam sua identidade cadastral. Em repositórios públicos, também podem ficar visíveis o nome de usuário do GitHub, a autoria de commits e arquivos enviados. Considere criar uma conta GitHub separada usando um pseudônimo e um e-mail adequado; configure o e-mail de commit como privado/noreply.

“© 2026 Ms. Addams. Todos os direitos reservados.” consta nas páginas. A titularidade dos textos originais é da autora; não é necessário publicar nome civil para essa indicação de direitos.

### Verificações

O código da interface foi adaptado às URLs de Supabase Edge Functions e funciona em caminhos relativos do GitHub Pages. A autenticação, o envio e as respostas só poderão ser testados integralmente após conectar contas e serviços.
