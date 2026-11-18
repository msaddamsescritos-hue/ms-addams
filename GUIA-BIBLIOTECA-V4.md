# Ms. Addams — Biblioteca 4.0 (18/11/2026)

Esta atualização acrescenta Radar de Leitura, reações anônimas, trechos favoritos, biblioteca por sentimentos, organização de correspondências e uma folha final com mensagens e sugestões.

**Não substitua nem recrie as tabelas existentes.** A Biblioteca 3.0, o agendamento, os capítulos e as correspondências continuam preservados.

## Ativação no Supabase — uma única etapa

1. Abra o projeto Supabase do site msaddams.com.
2. Vá a **SQL Editor → New query**.
3. No GitHub, abra **db/biblioteca-v4.sql** e copie todo o código.
4. Cole e clique em **Run**.
5. Confirme a mensagem **Success. No rows returned**.
6. Atualize o site e o Gabinete com **Ctrl + Shift + R**.

O SQL é adicional ao banco da Biblioteca 3.0, que já foi atualizado. Não precisa reaplicar os códigos antigos.

## O que fica disponível

### Radar de Leitura
No Gabinete → Indicadores, o Radar mostra o total acumulado de sessões iniciadas e as que chegaram à folha final. Há também marcos de 25%, 50% e 75%, total por capítulo e reações. O histórico começa após a execução do SQL, sem recuperar sessões antigas.

### Reações anônimas
Na última folha, escolha **Me identifiquei**, **Me fez refletir** ou **Precisava ler isso**. Uma nova escolha no mesmo navegador e para o mesmo capítulo substitui a anterior, se o armazenamento local estiver disponível.

### Meus Trechos
Dentro do capítulo, selecione um trecho de 12–420 caracteres e clique em **Guardar trecho**. Abra https://msaddams.com/meus-trechos.html para copiar, abrir a origem ou remover. Os trechos ficam exclusivamente no armazenamento deste navegador, sem cadastro.

### Biblioteca por sentimentos
Na página inicial, filtre por Amor, Amizade, Decepções, Recomeços e Autoconhecimento. No Gabinete → Manuscritos → Editar, escolha o **Tema principal** e salve. Os capítulos já existentes começam em **Outras reflexões** para evitar classificações automáticas erradas.

### Correspondências
Ao abrir uma carta no Gabinete, defina um **Assunto privado**, consultável pela pesquisa. O **Histórico desta correspondência** mostra cartas do mesmo endereço de e-mail, mas nunca pressupõe que pseudônimos iguais identifiquem a mesma pessoa. Respostas registradas são preservadas. Há novos modelos de resposta.

### Mensagem final e recomendações
No Gabinete → Manuscritos → Editar, escreva uma **Mensagem de encerramento** opcional. A última folha exibe a reflexão e sugere até dois capítulos publicados, priorizando o mesmo tema.

## Dados e privacidade

- As tabelas de sessões e reações não guardam nome, e-mail ou IP.
- A sessão usa um UUID aleatório por capítulo e aba, salvo no armazenamento da sessão do navegador.
- O Radar conta sessões, não pessoas únicas. A chegada ao fim não comprova que cada palavra foi lida.
- Ações podem não ser registradas por bloqueio de armazenamento, rede indisponível ou troca de dispositivos.
- Votos podem ser repetidos em navegadores ou dispositivos diferentes; dados são aproximados.
- As tabelas privadas são protegidas por RLS, e o banco expõe apenas totais públicos de reações.
- Manuscritos agendados continuam protegidos até a data de liberação.
- O arquivo SQL não apaga tabelas nem mensagens anteriores.

## Links para testar

- Biblioteca: https://msaddams.com/
- Meus Trechos: https://msaddams.com/meus-trechos.html
- Gabinete: https://msaddams.com/painel/
- SQL: https://github.com/msaddamsescritos-hue/ms-addams/blob/main/db/biblioteca-v4.sql
