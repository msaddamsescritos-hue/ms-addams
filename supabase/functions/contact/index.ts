import { cors, json, serverClient } from '../_shared/mod.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ error: 'Formato inválido.' }, 400); }
  if (typeof payload !== 'object' || !payload) return json({ error: 'Mensagem inválida.' }, 400);
  if (payload.website) return json({ ok: true }); // campo anti-spam invisível
  if (payload.consent !== true) return json({ error: 'É necessário aceitar a política de privacidade.' }, 422);
  const alias = String(payload.alias || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const message = String(payload.message || '').trim();
  if (alias.length < 1 || alias.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || message.length < 3 || message.length > 5000) {
    return json({ error: 'Confira o pseudônimo, e-mail e mensagem.' }, 422);
  }
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (turnstileSecret) {
    if (!payload.turnstileToken || typeof payload.turnstileToken !== 'string') return json({ error: 'Conclua a verificação de segurança.' }, 403);
    try {
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: turnstileSecret, response: payload.turnstileToken })
      });
      const result = await verify.json();
      if (!result.success) return json({ error: 'Verificação de segurança não concluída.' }, 403);
    } catch { return json({ error: 'Não foi possível validar a verificação de segurança.' }, 503); }
  }
  try {
    const { error } = await serverClient().from('letters').insert({ alias, email, message, status: 'new' });
    if (error) throw error;
    return json({ ok: true });
  } catch { return json({ error: 'Não foi possível entregar a carta. Tente novamente.' }, 503); }
});
