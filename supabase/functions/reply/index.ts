import { cors, json, isUuid, verifyAdmin } from '../_shared/mod.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ error: 'Solicitação inválida.' }, 400); }
  const letterId = payload?.letterId;
  const replyText = String(payload?.replyText || '').trim();
  if (!isUuid(letterId) || replyText.length < 2 || replyText.length > 10000) return json({ error: 'Carta ou resposta inválida.' }, 422);
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const mailFrom = Deno.env.get('MAIL_FROM');
  const replyTo = Deno.env.get('MAIL_REPLY_TO');
  if (!apiKey || !mailFrom) return json({ error: 'O envio de respostas ainda não foi ativado.' }, 503);
  try {
    const { server, error } = await verifyAdmin(request);
    if (error || !server) return error || json({ error: 'Acesso não autorizado.' }, 403);
    const { data: letter, error: claimError } = await server.from('letters').update({ status: 'sending' }).eq('id', letterId).eq('status', 'new').select('id,alias,email').maybeSingle();
    if (claimError) throw claimError;
    if (!letter) return json({ error: 'Carta já respondida ou em andamento.' }, 409);
    const sendPayload: Record<string, unknown> = {
      from: mailFrom.trim(),
      to: [letter.email],
      subject: 'Uma resposta de Ms. Addams',
      text: `Olá, ${letter.alias}.\n\n${replyText}\n\nCom discrição,\nMs. Addams\n\n—\nEsta mensagem é uma resposta à carta enviada pelo site de Ms. Addams.`
    };
    if (replyTo) sendPayload.reply_to = replyTo.trim();
    let emailSent = false;
    try {
      const result = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `msaddams-letter-${letterId}` },
        body: JSON.stringify(sendPayload)
      });
      if (!result.ok) throw new Error(`Envio recusado (${result.status}).`);
      emailSent = true;
      const { error: updateError } = await server.from('letters').update({ status: 'replied', reply_text: replyText, replied_at: new Date().toISOString() }).eq('id', letterId).eq('status', 'sending');
      if (updateError) throw updateError;
      return json({ ok: true });
    } catch {
      if (!emailSent) await server.from('letters').update({ status: 'new' }).eq('id', letterId).eq('status', 'sending');
      return json({ error: emailSent ? 'E-mail aceito; falha ao salvar histórico. Confira o Resend antes de tentar novamente.' : 'Não foi possível enviar. Confira a configuração do remetente.' }, 503);
    }
  } catch { return json({ error: 'Não foi possível processar a resposta.' }, 503); }
});
