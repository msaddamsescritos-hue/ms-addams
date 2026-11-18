# Ms. Addams — Biblioteca 3.0 · Guia de ativação

**Atualizado em 18/11/2026.**

As mudanças de visual e os formulários foram incluídos no GitHub, sem substituir o banco existente, o Gabinete privado ou as correspondências recebidas.

## ETAPA 1 — Ativar os recursos no banco (obrigatório)

1. Faça login no Supabase, no projeto usado em msaddams.com.
2. Abra **SQL Editor → New query**, com **Database** selecionado.
3. Abra no GitHub o arquivo `db/biblioteca-v3.sql` e copie **todo** o código.
4. Cole no SQL Editor e execute **Run**.
5. Confirme **Success. No rows returned**.
6. Atualize o Gabinete: https://msaddams.com/painel/ com Ctrl+Shift+R.

**Importante:** o SQL acrescenta campos às tabelas, cria tabelas novas com RLS e adiciona um gatilho de histórico. Não apaga capítulos nem correspondências. As versões antigas anteriores à instalação não são recuperadas pelo histórico.

## ETAPA 2 — Testar recursos

- Capa: abra um capítulo na biblioteca; a primeira página é sua capa ilustrada, e as setas viram o livro.
- Marcador: avance até uma página, use **Marcar página**, feche e abra novamente no mesmo navegador. A página é restaurada no mesmo dispositivo.
- Personalização: no Gabinete → Manuscritos → Editar, escolha **Capa** e **Papel**, salve e confira a página pública.
- Cartas da autora: Gabinete → Cartas da autora; crie uma carta e salve **rascunho**. Não aparece ao público. Clique em **Publicar carta** para aparecer em https://msaddams.com/cartas-da-autora.html.
- Estúdio Instagram: Gabinete → Estúdio Instagram; selecione capítulo, escreva frase, escolha Story/Feed/Quadrado, clique **Criar cartão** e **Baixar PNG**.
- Próxima revelação: agende um capítulo no Gabinete. A página inicial exibe apenas a data e uma chamada misteriosa; nunca mostra título ou texto antecipadamente.
- Indicadores: Gabinete → Indicadores. As contagens são aproximadas por sessão e começam **após a instalação**; não são visitantes únicos.
- Histórico: no editor de capítulos, clique **Consultar versões**. Modifique e salve um texto para criar uma versão; use **Restaurar** para recuperar a versão anterior.

## ETAPA 3 — Ativar avisos automáticos do Clube (configuração adicional)

**Não envie senhas nem chaves no chat, nem as coloque em `docs/assets/config.js`.**

1. O Clube de Leitores precisa estar funcionando como descrito em `CLUBE-LEITORES-ATIVAR.md`, com base `db/clube-leitores.sql`, inscrições confirmadas, `club_notification_sends`, Resend e remetente verificado.
2. No painel Supabase → Edge Functions → Secrets, crie um segredo privado **CLUB_AUTO_SECRET** com pelo menos 32 caracteres aleatórios. Não o divulgue.
3. Publique `supabase/functions/club-auto/index.ts` como a Edge Function chamada **club-auto**, **sem exigir JWT da plataforma**, pois ela valida o cabeçalho secreto `x-automation-secret` dentro do próprio código. Confirme também as variáveis existentes `RESEND_API_KEY`, `CLUB_MAIL_FROM`, `CLUB_LINK_SECRET`.
4. No GitHub → repositório `ms-addams` → **Settings → Secrets and variables → Actions**, configure dois segredos:
   - `MS_ADDAMS_SUPABASE_URL`: URL base de seu projeto Supabase, sem `/rest/v1`;
   - `MS_ADDAMS_CLUB_AUTO_SECRET`: exatamente o mesmo segredo privado `CLUB_AUTO_SECRET` configurado na Edge Function.
5. O fluxo `.github/workflows/clube-automatico.yml` verifica novos capítulos a cada 30 minutos, dependendo do agendamento do GitHub Actions. Ele pode ser executado manualmente por **Actions → Ms Addams - Avisos automáticos do Clube → Run workflow** para teste.
6. No Gabinete, em **Manuscritos**, habilite a caixa **Enviar aviso automático aos leitores confirmados** no capítulo desejado e salve. O padrão é **desativado**.
7. Teste primeiro com um e-mail confirmado de sua propriedade e confira o provedor. Não é necessário clicar em "Enviar avisos" após a publicação programada.

Para que o botão manual de avisos também aceite capítulos liberados por agendamento, publique a versão atualizada de `supabase/functions/club-notify/index.ts`. Até então, ele pode rejeitar esses capítulos.

**Proteções:** somente inscrições `confirmed`; link individual de cancelamento; chaves nunca no navegador; lotes de até 10 leitores por capítulo, até 4 capítulos por execução; a função do banco registra cada envio para evitar duplicações. Falhas não são reenviadas automaticamente. Não existe garantia de entrega imediata nem exata no horário da publicação.

## Privacidade e manutenção

- O site continua no GitHub Pages, com os capítulos e cartas no Supabase.
- Os manuscritos futuros permanecem privados pelas políticas existentes até a data de liberação; a chamada pública não revela conteúdo, nome ou título.
- Os números de leitura não contêm IP, nome ou e-mail na tabela específica criada para estatísticas. Valores dependem de navegadores, bloqueios e sessões.
- O histórico de manuscritos e as notas privadas têm políticas de acesso exclusivas para a autora.
- As ilustrações são arquivos locais e os cartões são gerados no próprio navegador.
- Reveja a privacidade e os metadados do repositório antes de publicações que possam identificar quem escreve sob pseudônimo.

**Se algo não aparecer:** atualize a página com Ctrl+Shift+R. Se persistir, confira o SQL e a aba Actions do GitHub; não execute scripts desconhecidos ou apague tabelas.
