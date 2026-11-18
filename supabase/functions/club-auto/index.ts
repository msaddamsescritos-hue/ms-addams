// Ms. Addams — Avisos automáticos do Clube das Entrelinhas.
// EXCLUSIVAMENTE PARA INSCRITOS COM STATUS 'confirmed'.
// Requer segredo CLUB_AUTO_SECRET >= 32 caracteres e serviço Resend configurado.
// Executado por GitHub Actions após deploy da Edge Function.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json=(body:Record<string,unknown>,status=200)=>
  new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const validSecret=(received:string,expected:string)=>{
  const a=new TextEncoder().encode(received),b=new TextEncoder().encode(expected);
  let mismatch=a.length^b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++)mismatch|=(a[i]||0)^(b[i]||0);
  return mismatch===0;
};
const htmlEscape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function signedUnsubscribe(secret:string,id:string){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const data=new TextEncoder().encode('club-unsubscribe:'+id);
  const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,data));
  return Array.from(sig).map(n=>n.toString(16).padStart(2,'0')).join('');
}
Deno.serve(async request=>{
  if(request.method!=='POST')return json({error:'Método inválido.'},405);
  const expected=Deno.env.get('CLUB_AUTO_SECRET')||'';
  const received=request.headers.get('x-automation-secret')||'';
  if(expected.length<32||!validSecret(received,expected))return json({error:'Não autorizado.'},403);
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const mailKey=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('CLUB_MAIL_FROM'),linkSecret=Deno.env.get('CLUB_LINK_SECRET');
  if(!url||!service||!mailKey||!from||!linkSecret||linkSecret.length<32)
    return json({error:'Configuração privada incompleta.'},503);
  const server=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const now=new Date().toISOString();
  // Capítulos autorizados pela autora e já liberados pelo horário do banco.
  const {data:eligible,error}=await server.from('chapters')
    .select('slug,title,scheduled_at,published,auto_notify')
    .eq('auto_notify',true)
    .or('and(published.eq.true,scheduled_at.is.null),scheduled_at.lte.'+now)
    .order('number',{ascending:true}).limit(4);
  if(error)return json({error:'Não foi possível consultar os capítulos.'},503);
  let processed=0,sent=0,failed=0,skipped=0;
  for(const chapter of eligible||[]){
    // Reconsulta a autorização imediatamente antes de reservar avisos.
    const {data:latest}=await server.from('chapters')
      .select('slug,auto_notify,scheduled_at,published,title')
      .eq('slug',chapter.slug).maybeSingle();
    if(!latest||!latest.auto_notify)continue;
    const released=latest.scheduled_at?
      new Date(latest.scheduled_at).getTime()<=Date.now():latest.published===true;
    if(!released)continue;
    const {data:batch,error:claimError}=await server.rpc('club_claim_notification_batch',{
      p_slug:latest.slug,p_limit:10
    });
    if(claimError)return json({error:'Função de controle de duplicidade não disponível.'},503);
    for(const reader of batch||[]){
      processed++;
      const id=String(reader.subscriber_id);
      const {data:active}=await server.from('club_subscribers').select('status').eq('id',id).maybeSingle();
      if(active?.status!=='confirmed'){
        await server.from('club_notification_sends').update({status:'skipped'})
          .eq('chapter_slug',latest.slug).eq('subscriber_id',id);
        skipped++;continue;
      }
      const unsubscribe='https://msaddams.com/clube.html#unsubscribe='+id+'.'+await signedUnsubscribe(linkSecret,id);
      const href='https://msaddams.com/capitulo.html?slug='+encodeURIComponent(latest.slug);
      const title=htmlEscape(String(latest.title));
      const html='<div style="max-width:630px;margin:auto;padding:36px;background:#f5eee5;color:#342735;font-family:Georgia,serif;border-top:5px solid #704a60">'+
        '<p style="font:12px Arial;letter-spacing:2px;color:#865c70">MS. ADDAMS · CLUBE DAS ENTRELINHAS</p>'+
        '<h2 style="font-size:29px;font-weight:normal">Caro(a) leitor(a),</h2>'+
        '<p style="font-size:21px;line-height:1.6">Uma nova página foi aberta no nosso arquivo de desventuras.</p>'+
        '<h3 style="font-size:27px;font-weight:normal">'+title+'</h3>'+
        '<p><a href="'+htmlEscape(href)+'" style="padding:13px 18px;display:inline-block;background:#634155;color:#fff;text-decoration:none">Ler o manuscrito</a></p>'+
        '<p style="font-size:20px;font-style:italic;margin-top:30px">Com carinho,<br>Ms. Addams</p>'+
        '<p style="font:12px/1.5 Arial;color:#8c7380">Você recebe esta carta porque confirmou a inscrição no Clube de Leitores. '+
        '<a href="'+htmlEscape(unsubscribe)+'">Cancelar inscrição</a>.</p></div>';
      try{
        const response=await fetch('https://api.resend.com/emails',{
          method:'POST',headers:{
            Authorization:'Bearer '+mailKey,'Content-Type':'application/json',
            'Idempotency-Key':'msaddams-club-'+latest.slug+'-'+id
          },
          body:JSON.stringify({
            from,to:[String(reader.email)],
            subject:'Um novo manuscrito | Ms. Addams',
            html,
            text:'Caro(a) leitor(a),\n\nUm novo manuscrito: '+latest.title+
              '\nLeia: '+href+'\n\nCom carinho,\nMs. Addams\n\nCancelar inscrição: '+unsubscribe
          })
        });
        if(!response.ok)throw new Error('Provedor de e-mail não aceitou a solicitação.');
        const {error:e}=await server.from('club_notification_sends')
          .update({status:'sent',sent_at:new Date().toISOString()})
          .eq('chapter_slug',latest.slug).eq('subscriber_id',id);
        if(e)throw e;
        sent++;
      }catch{
        // Não repetir automaticamente: e-mail pode ter sido entregue antes da falha de confirmação.
        await server.from('club_notification_sends').update({status:'failed'})
          .eq('chapter_slug',latest.slug).eq('subscriber_id',id);
        failed++;
      }
    }
  }
  return json({ok:true,processed,sent,failed,skipped,chapterCount:(eligible||[]).length});
});
