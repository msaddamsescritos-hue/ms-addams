
async function replyLetter(event) {
  event.preventDefault();

  if (!currentLetter) return;

  const body = clean($('reply-body').value);

  if (body.length < 2 || body.length > 10000) {
    status('reply-feedback',
      'A resposta deve conter entre 2 e 10.000 caracteres.',
      true);
    return;
  }

  const recipient = currentLetter.email;
  const subject = 'Uma resposta de Ms. Addams';
  const gmailUrl = new URL(
    'https://mail.google.com/mail/u/0/'
  );

  gmailUrl.searchParams.set('view', 'cm');
  gmailUrl.searchParams.set('fs', '1');
  gmailUrl.searchParams.set('to', recipient);
  gmailUrl.searchParams.set('su', subject);
  gmailUrl.searchParams.set(
    'body',
    body + '\n\nCom carinho,\nMs. Addams'
  );

  const popup = window.open(
    gmailUrl.toString(),
    '_blank',
    'noopener,noreferrer'
  );

  if (!popup) {
    status('reply-feedback',
      'Permita a abertura de janelas para acessar o Gmail.',
      true);
    return;
  }

  status('reply-feedback',
    'Gmail aberto. Confira o remetente e envie a resposta. ' +
    'A carta continuará pendente até confirmarmos o envio.'
  );
}
