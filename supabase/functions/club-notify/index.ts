import { cors, json, verifyAdmin } from '../_shared/mod.ts';

const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
const hex=(values:Uint8Array)=>Array.from(values).map(x=>x.toString(16).padStart(2,'0')).join('');
async function sign(secret:string,id:string){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('club-unsubscribe:'+id))));
}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return json({error:'Método não permitido.'},405);
  let payload:Record<string,unknown>;
  try {payload=await request.json();}catch{return json({error:'Solicitação inválida.'},400);}
  const mode=payload?.mode;
  const slug=String(payload?.slug||'').trim();
  if(!['preview','send'].includes(String(mode))||!/^[a-z0-9-]{1,140}$/.test(slug)){
    return json({error:'Capítulo ou ação inválida.'},422);
  }
  try {
    const {server,error:authError}=await verifyAdmin(request);
    if(authError||!server)return authError||json({error:'Não autorizado.'},403);
    const {data:chapter,error:chapterError}=await server.from('chapters')
      .select('slug,number,title,published').eq('slug',slug).eq('published',true).maybeSingle();
    if(chapterError)throw chapterError;
    if(!chapter)return json({error:'O capítulo precisa estar publicado.'},422);
    const {count:confirmed,error:countError}=await server.from('club_subscribers')
      .select('id',{head:true,count:'exact'}).eq('status','confirmed');
    if(countError)throw countError;
    const {count:sent,error:sentError}=await server.from('club_notification_sends')
      .select('subscriber_id',{head:true,count:'exact'}).eq('chapter_slug',slug).eq('status','sent');
    if(sentError)throw sentError;
    if(mode==='preview')return json({ok:true,title:chapter.title,confirmed:confirmed||0,sent:sent||0});

    const apiKey=Deno.env.get('RESEND_API_KEY');
    const from=Deno.env.get('CLUB_MAIL_FROM');
    const secret=Deno.env.get('CLUB_LINK_SECRET');
    if(!apiKey||!from||!secret||secret.length<32)return json({error:'Remetente do clube ainda não configurado.'},503);

    const {data:batch,error:batchError}=await server.rpc('club_claim_notification_batch',{p_slug:slug,p_limit:10});
    if(batchError)throw batchError;
    const recipients=Array.isArray(batch)?batch:[];
    let sentNow=0,failedNow=0,skipped=0;
    for(const recipient of recipients){
      const id=String(recipient.subscriber_id);
      // Confirmar novamente a elegibilidade imediatamente antes do disparo.
      const {data:stillActive}=await server.from('club_subscribers').select('status')
        .eq('id',id).maybeSingle();
      if(stillActive?.status!=='confirmed'){
        await server.from('club_notification_sends').update({status:'skipped'}).eq('chapter_slug',slug).eq('subscriber_id',id);
        skipped++;
        continue;
      }
      const unsubscribe='https://msaddams.com/clube.html#unsubscribe='+id+'.'+await sign(secret,id);
      const readingUrl='https://msaddams.com/capitulo.html?slug='+encodeURIComponent(slug);
      const subject='Um novo manuscrito espera por você | Ms. Addams';
      const html='<div style="max-width:630px;margin:auto;background:#f7f0e9;padding:35px;color:#352935;font-family:Georgia,serif;border-top:5px solid #694756">'+
        '<p style="font:11px Arial,sans-serif;letter-spacing:2px;color:#986c81">CLUBE DAS ENTRELINHAS · MS. ADDAMS</p>'+
        '<h1 style="font-size:29px;font-weight:normal;color:#6b4859">Caro(a) leitor(a),</h1>'+
        '<p style="font-size:20px;line-height:1.5">Uma nova história foi acrescentada ao arquivo. Talvez ela guarde algo que só você saberá reconhecer.</p>'+
        '<h2 style="font-size:27px;font-weight:normal;color:#70495b">'+escapeHtml(String(chapter.title))+'</h2>'+
        '<p><a href="'+escapeHtml(readingUrl)+'" style="display:inline-block;padding:14px 20px;background:#68485a;color:#fff4ec;text-decoration:none;font:13px Arial,sans-serif">Descobrir o manuscrito →</a></p>'+
        '<p style="font-size:19px;font-style:italic;margin:30px 0">Até que nossas palavras se encontrem novamente,<br>Ms. Addams</p>'+
        '<p style="font:12px/1.5 Arial,sans-serif;color:#8c7480;border-top:1px solid #d8c2c6;padding-top:17px">Você recebe esta mensagem porque confirmou sua inscrição no Clube de Leitores. <a href="'+escapeHtml(unsubscribe)+'">Cancelar inscrição</a>.</p></div>';
      try{
        const res=await fetch('https://api.resend.com/emails',{
          method:'POST',
          headers:{
            'Authorization':'Bearer '+apiKey,
            'Content-Type':'application/json',
            'Idempotency-Key':'msaddams-club-'+slug+'-'+id
          },
          body:JSON.stringify({
            from,to:[String(recipient.email)],subject,html,
            text:'Caro(a) leitor(a),\n\nHá um novo capítulo: '+chapter.title+
              '\n\nLeia: '+readingUrl+
              '\n\nAté que nossas palavras se encontrem novamente,\nMs. Addams\n\nCancelar inscrição: '+unsubscribe
          })
        });
        if(!res.ok)throw new Error('E-mail não aceito pelo provedor.');
        const {error:updateError}=await server.from('club_notification_sends')
          .update({status:'sent',sent_at:new Date().toISOString()})
          .eq('chapter_slug',slug).eq('subscriber_id',id);
        if(updateError)throw updateError;
        sentNow++;
      }catch{
        // Uma mensagem aceita pelo provedor pode já ter sido entregue:
        // registrar falha sem reenviar automaticamente evita duplicações.
        await server.from('club_notification_sends').update({status:'failed'})
          .eq('chapter_slug',slug).eq('subscriber_id',id);
        failedNow++;
      }
    }
    return json({ok:true,processed:recipients.length,sent:sentNow,failed:failedNow,skipped,
      moreMayRemain:recipients.length===10,
      message:recipients.length===0?'Não há novos leitores confirmados para este capítulo.':'Lote de avisos processado.'});
  }catch{return json({error:'Não foi possível consultar ou processar os avisos. Confira as configurações do clube.'},503);}
});
