# Ms. Addams — Manuscritos interativos e agendamento

## Já instalado no GitHub
- Modo "Folhear como livro" na leitura, com páginas numeradas e animação discreta. Leitura contínua continua disponível.
- Botão "Criar cartão de frase": selecione uma frase do capítulo (ou use a epígrafe) e baixe um PNG assinado para compartilhar.
- Editor com opção para agendar a data e a hora da publicação.

## Falta uma etapa para ATIVAR o agendamento
1. Acesse Supabase → projeto Ms. Addams → SQL Editor → New query → opção Database.
2. Abra o arquivo db/agendamento-capitulos.sql neste repositório.
3. Copie todo o SQL, cole no SQL Editor e clique em Run.
4. Se aparecer Success, atualize o Gabinete com Ctrl+Shift+R.
5. Edite ou crie um capítulo, selecione data e hora locais futuras, clique em Agendar publicação.

A publicação será visível para visitantes assim que a data/hora escolhida chegar, sem precisar de cron, abrir o Gabinete ou reenviar arquivos ao GitHub. A hora escolhida é convertida para UTC pelo navegador e comparada pelo PostgreSQL usando now(); o público não consegue ler o texto antecipadamente por via da API (RLS).

ATENÇÃO: execute o SQL antes do primeiro agendamento. Caso contrário, escrever/salvar/publicar de forma normal continuará funcionando, mas a opção de agendar ficará indisponível.

Os avisos do Clube de Leitores não são enviados automaticamente pelo agendamento: continuam sendo disparados manualmente após a publicação.

## Segurança e privacidade
- Não coloque senha, secret key ou service_role no repositório.
- Os manuscritos futuros ficam protegidos por RLS.
- O cartão de frase é gerado no dispositivo do leitor.
- Progresso de leitura e favoritos permanecem apenas no navegador.
