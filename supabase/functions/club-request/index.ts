const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};
const json = (body:Record<string,unknown>, status=200) =>
  new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
const serverClient = () => {
  const url=Deno.env.get('SUPABASE_URL');
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)throw new Error('Servidor não configurado.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
};
import {createClient} from 'npm:@supabase/supabase-js@2';

const isEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const generic = 'Se este endereço puder receber correspondências, uma mensagem será enviada com as instruções.';
const hex = (buf: Uint8Array) => Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256(text: string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}
async function hmac(secret: string, text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))));
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function sendMail(recipient: string, subject: string, link: string, type: 'subscribe'|'leave', key: string, from: string) {
  const confirming = type === 'subscribe';
  const preface = confirming
    ? 'Alguém pediu para receber novidades do Clube de Leitores da Ms. Addams. Para confirmar que o endereço pertence a você, abra o link abaixo. Se não solicitou, ignore esta mensagem.'
    : 'Foi solicitado o cancelamento das novidades da Ms. Addams. Se foi você, confirme pelo link abaixo. Se não solicitou, ignore esta mensagem.';
  const verb = confirming ? 'Confirmar minha inscrição' : 'Cancelar minha inscrição';
  const html = '<div style="font-family:Georgia,serif;max-width:620px;margin:auto;padding:36px;background:#f8f2ec;color:#382d35;border-top:5px solid #674656">' +
    '<p style="font:12px Arial,sans-serif;letter-spacing:2px;color:#8c6477">CORRESPONDÊNCIA PARTICULAR · MS. ADDAMS</p>' +
    '<h1 style="font-weight:normal;font-size:30px;color:#694657">Caro(a) leitor(a),</h1>' +
    '<p style="font-size:20px;line-height:1.65">' + escapeHtml(preface) + '</p>' +
    '<p><a style="display:inline-block;padding:15px 19px;color:#fff8ef;background:#664557;text-decoration:none;font:14px Arial,sans-serif" href="' + escapeHtml(link) + '">' + verb + '</a></p>' +
    '<p style="font-size:14px;color:#755e69">Se o botão não funcionar, copie o link: ' + escapeHtml(link) + '</p>' +
    '<p style="font-style:italic;font-size:20px;margin-top:28px">Até que nossas palavras se encontrem novamente,<br>Ms. Addams</p></div>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {'Authorization':'Bearer ' + key,'Content-Type':'application/json'},
    body: JSON.stringify({
      from, to: [recipient], subject, html,
      text: preface + '\n\n' + verb + ': ' + link + '\n\nMs. Addams'
    })
  });
  if (!response.ok) throw new Error('Falha do provedor de e-mail (' + response.status + ')');
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (request.method !== 'POST') return json({error:'Método não permitido.'},405);
  let payload: Record<string,unknown>;
  try { payload = await request.json(); } catch { return json({error:'Solicitação inválida.'},400); }
  if (!payload || typeof payload !== 'object') return json({error:'Solicitação inválida.'},400);
  if (payload.website) return json({ok:true,message:generic});
  const action = payload.action === 'leave' ? 'leave' : payload.action === 'subscribe' ? 'subscribe' : '';
  const email = String(payload.email || '').trim().toLowerCase();
  const alias = String(payload.pseudonym || '').trim().slice(0,80) || null;
  if (!action || !isEmail(email)) return json({error:'Informe um endereço de e-mail válido.'},422);
  if (action === 'subscribe' && payload.consent !== true) return json({error:'É necessário consentir com o recebimento das novidades.'},422);
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('CLUB_MAIL_FROM');
  const secret = Deno.env.get('CLUB_LINK_SECRET');
  const captchaSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!apiKey || !from || !secret || secret.length < 32 || !captchaSecret) {
    return json({error:'As inscrições ainda não estão disponíveis. Tente novamente mais tarde.'},503);
  }
  if (typeof payload.turnstileToken !== 'string' || !payload.turnstileToken) return json({error:'Conclua a verificação de segurança.'},403);
  try {
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({secret:captchaSecret,response:payload.turnstileToken})
    });
    const verification = await verify.json();
    if (!verification.success || !['msaddams.com','www.msaddams.com'].includes(String(verification.hostname||''))) {
      return json({error:'Não foi possível validar a verificação.'},403);
    }
  } catch { return json({error:'Não foi possível validar a verificação. Tente novamente.'},503); }
  try {
    const server = serverClient();
    const {data:existing,error:readError} = await server.from('club_subscribers')
      .select('id,status,last_confirmation_sent_at,last_unsubscribe_sent_at').eq('email',email).maybeSingle();
    if (readError) throw readError;
    const lastSent = action === 'subscribe' ? existing?.last_confirmation_sent_at : existing?.last_unsubscribe_sent_at;
    const cooldown = lastSent && Date.now()-new Date(lastSent).getTime() < 10*60*1000;
    if (cooldown || (action === 'subscribe' && existing?.status === 'confirmed') || (action === 'leave' && existing?.status !== 'confirmed')) {
      return json({ok:true,message:generic});
    }
    if (action === 'subscribe') {
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      const id = existing?.id || crypto.randomUUID();
      const now = new Date().toISOString();
      const record = {
        id,email,pseudonym:alias,status:'pending',consented_at:now,confirmed_at:null,unsubscribed_at:null,
        confirmation_hash:await sha256(token),
        confirmation_expires_at:new Date(Date.now()+24*3600*1000).toISOString(),
        last_confirmation_sent_at:now,last_action_mail_at:now
      };
      const {error:writeError} = await server.from('club_subscribers').upsert(record,{onConflict:'email'});
      if (writeError) throw writeError;
      const link = 'https://msaddams.com/clube.html#confirm=' + id + '.' + token;
      await sendMail(email,'Confirme sua entrada no Clube de Leitores | Ms. Addams',link,'subscribe',apiKey,from);
    } else {
      const id = existing!.id;
      const signature = await hmac(secret,'club-unsubscribe:' + id);
      const link = 'https://msaddams.com/clube.html#unsubscribe=' + id + '.' + signature;
      const {error:writeError} = await server.from('club_subscribers').update({last_unsubscribe_sent_at:new Date().toISOString()}).eq('id',id);
      if (writeError) throw writeError;
      await sendMail(email,'Confirme seu cancelamento | Ms. Addams',link,'leave',apiKey,from);
    }
    return json({ok:true,message:generic});
  } catch {
    return json({error:'Não foi possível processar sua solicitação. Tente novamente mais tarde.'},503);
  }
});
