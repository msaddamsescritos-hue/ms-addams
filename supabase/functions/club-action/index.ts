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

const validId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const hex = (buf: Uint8Array) => Array.from(buf).map(b=>b.toString(16).padStart(2,'0')).join('');
async function digest(s: string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
}
async function signature(secret:string, data:string) {
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data))));
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (request.method !== 'POST') return json({error:'Método não permitido.'},405);
  let payload:Record<string,unknown>;
  try { payload=await request.json(); } catch {return json({error:'Solicitação inválida.'},400);}
  const action = payload?.action;
  const fullToken = typeof payload?.token === 'string' ? payload.token : '';
  const pair = /^([0-9a-f-]{36})\.([0-9a-f]{64})$/i.exec(fullToken);
  if (!pair || !validId(pair[1]) || !['confirm','unsubscribe'].includes(String(action))) {
    return json({error:'Este link não é válido.'},422);
  }
  const [,id,token] = pair;
  try {
    const server = serverClient();
    if (action === 'confirm') {
      const hashed = await digest(token);
      const {data,error} = await server.from('club_subscribers')
        .update({
          status:'confirmed', confirmed_at:new Date().toISOString(),
          confirmation_hash:null,confirmation_expires_at:null,unsubscribed_at:null
        })
        .eq('id',id)
        .eq('status','pending')
        .eq('confirmation_hash',hashed)
        .gt('confirmation_expires_at',new Date().toISOString())
        .select('id').maybeSingle();
      if (error) throw error;
      if (!data) return json({error:'O link expirou ou já foi utilizado. Solicite uma nova inscrição.'},410);
      return json({ok:true,message:'Sua entrada no Clube de Leitores foi confirmada. Seja bem-vindo(a) às entrelinhas.'});
    }
    const secret=Deno.env.get('CLUB_LINK_SECRET') || '';
    if (secret.length < 32) return json({error:'Serviço temporariamente indisponível.'},503);
    const expected=await signature(secret,'club-unsubscribe:' + id);
    if (expected !== token.toLowerCase()) return json({error:'Link de cancelamento inválido.'},422);
    const {error}=await server.from('club_subscribers')
      .update({
        status:'unsubscribed',unsubscribed_at:new Date().toISOString(),
        confirmation_hash:null,confirmation_expires_at:null
      }).eq('id',id).eq('status','confirmed');
    if (error) throw error;
    return json({ok:true,message:'Você não receberá novas correspondências do clube. Seu pedido foi registrado.'});
  } catch {
    return json({error:'Não foi possível concluir a solicitação. Tente novamente.'},503);
  }
});
