/* Ms. Addams | Gabinete 3.0. RLS protege todos os dados. */
(()=>{
'use strict';
const $=id=>document.getElementById(id), cfg=window.ADDAMS_CONFIG||{};
const db=cfg.supabaseUrl&&cfg.supabasePublishableKey&&window.supabase?
  window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey):null;
const node=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=String(value);return n;};
const msg=(id,value,error)=>{const n=$(id);if(n){n.textContent=value;n.style.color=error?'#e7a1aa':'#dcc7c7';}};
const clean=x=>String(x||'').trim(),fmt=x=>new Date(x).toLocaleString('pt-BR');
let notes=[],chapters=[];
function clearNote(){$('note-id').value='';$('note-title').value='';$('note-body').value='';}
async function listNotes(){
 if(!db)return;
 const el=$('notes-list');el.replaceChildren(node('p','v3-quiet','Consultando cartas...'));
 const {data,error}=await db.from('author_notes').select('id,title,body,published,created_at').order('created_at',{ascending:false});
 el.replaceChildren();
 if(error){msg('notes-feedback','Para ativar esta seção, execute db/biblioteca-v3.sql no Supabase.',true);return;}
 notes=data||[];
 if(!notes.length)el.append(node('p','v3-quiet','Nenhuma carta escrita ainda.'));
 notes.forEach(c=>{
  const card=node('div','v3-list-item'),detail=node('div');
  detail.append(node('h3','',c.title),node('p','',c.published?'Publicada':'Rascunho privado'));
  const actions=node('div','actions'),edit=node('button','outline-btn','Editar'),del=node('button','outline-btn danger','Excluir');
  edit.type=del.type='button';
  edit.onclick=()=>{$('note-id').value=c.id;$('note-title').value=c.title;$('note-body').value=c.body;$('note-title').focus();};
  del.onclick=async()=>{if(!confirm('Excluir definitivamente esta carta?'))return;
    const {error:e}=await db.from('author_notes').delete().eq('id',c.id);
    if(e)msg('notes-feedback',e.message,true);else{clearNote();listNotes();}
  };
  actions.append(edit,del);card.append(detail,actions);el.append(card);
 });
 msg('notes-feedback','Rascunhos só são visíveis para a autora.');
}
async function saveNote(published){
 if(!db)return;
 const title=clean($('note-title').value),body=clean($('note-body').value),id=$('note-id').value;
 if(!title||!body){msg('notes-feedback','Preencha título e texto.',true);return;}
 const payload={title,body,published};
 const req=id?db.from('author_notes').update(payload).eq('id',id):db.from('author_notes').insert(payload);
 const {error}=await req;
 if(error){msg('notes-feedback','Não foi possível salvar. Ative o banco: '+error.message,true);return;}
 clearNote();await listNotes();msg('notes-feedback',published?'Carta publicada.':'Rascunho salvo.');
}
$('note-save-draft')?.addEventListener('click',()=>saveNote(false));
$('note-publish')?.addEventListener('click',()=>saveNote(true));
$('note-new')?.addEventListener('click',clearNote);
async function versions(){
 if(!db)return;const list=$('history-list');list.replaceChildren();
 const id=$('chapter-id').value;
 if(!id){list.append(node('p','v3-quiet','Salve o capítulo para consultar o histórico.'));return;}
 const {data,error}=await db.from('chapter_versions')
  .select('id,title,epigraph,body,cover_theme,paper_theme,saved_at').eq('chapter_id',id)
  .order('saved_at',{ascending:false}).limit(20);
 if(error){list.append(node('p','v3-quiet','Ative o histórico executando db/biblioteca-v3.sql.'));return;}
 if(!data?.length){list.append(node('p','v3-quiet','Ainda não há versões anteriores.'));return;}
 data.forEach((v,i)=>{
  const row=node('div','v3-history-item');
  row.append(node('span','','Versão '+(data.length-i)+' · '+fmt(v.saved_at)));
  const b=node('button','outline-btn','Restaurar');b.type='button';
  b.onclick=async()=>{
   if(!confirm('Restaurar esta versão? A versão atual ficará arquivada.'))return;
   const update={title:v.title,epigraph:v.epigraph,body:v.body};
   if(v.cover_theme)update.cover_theme=v.cover_theme;
   if(v.paper_theme)update.paper_theme=v.paper_theme;
   const {error:e}=await db.from('chapters').update(update).eq('id',id);
   if(e)alert('Não foi possível restaurar: '+e.message);else location.reload();
  };
  row.append(b);list.append(row);
 });
}
$('load-versions')?.addEventListener('click',versions);
async function insights(){
 if(!db)return;msg('insights-feedback','Consultando...');
 const el=$('chapter-insights');el.replaceChildren();
 const {data,error}=await db.rpc('chapter_read_summary');
 if(error){msg('insights-feedback','Para ativar, execute db/biblioteca-v3.sql. As contagens começam na instalação.',true);return;}
 const max=Math.max(1,...(data||[]).map(c=>Number(c.total_reads)||0));
 (data||[]).forEach(c=>{
  const row=node('div','v3-list-item'),body=node('div','v3-metric');
  body.append(node('h3','',c.chapter_title),node('strong','',Number(c.total_reads||0).toLocaleString('pt-BR')+' leituras'));
  body.append(node('p','','Nos últimos 7 dias: '+Number(c.recent_reads||0).toLocaleString('pt-BR')));
  const bar=node('div','v3-bar'),fill=node('span');fill.style.width=100*Number(c.total_reads||0)/max+'%';
  bar.append(fill);body.append(bar);row.append(body);el.append(row);
 });
 if(!data?.length)el.append(node('p','v3-quiet','Ainda não há dados de capítulos.'));
 msg('insights-feedback','Leituras aproximadas por sessão, sem identificar pessoas.');
}
$('refresh-chapter-insights')?.addEventListener('click',insights);
async function studioLoad(){
 if(!db)return;
 const {data,error}=await db.from('chapters').select('slug,title,epigraph,body,published,scheduled_at').order('number');
 if(error){msg('studio-feedback','Não foi possível consultar os capítulos.',true);return;}
 const now=Date.now();
 chapters=(data||[]).filter(c=>(c.published&&!c.scheduled_at)||(c.scheduled_at&&new Date(c.scheduled_at).getTime()<=now));
 const select=$('studio-chapter'),before=select.value;select.replaceChildren(new Option('Selecione um manuscrito',''));
 chapters.forEach(c=>select.add(new Option(c.title,c.slug)));
 if(chapters.some(c=>c.slug===before))select.value=before;
}
$('studio-chapter')?.addEventListener('change',()=>{
 const c=chapters.find(x=>x.slug===$('studio-chapter').value);
 if(c)$('studio-text').value=clean(c.epigraph||c.body.split(/[.!?]\s/)[0]).slice(0,450);
});
function wrap(ctx,s,max){
 const out=[];let line='';
 for(const word of s.split(/\s+/)){const n=line?line+' '+word:word;
  if(line&&ctx.measureText(n).width>max){out.push(line);line=word;}else line=n;}
 if(line)out.push(line);return out;
}
async function studioCreate(){
 const phrase=clean($('studio-text').value);if(phrase.length<10){msg('studio-feedback','Digite uma frase com pelo menos dez caracteres.',true);return;}
 if(document.fonts?.ready)await document.fonts.ready;
 const can=$('studio-canvas'),format=$('studio-format').value,style=$('studio-style').value;
 const W=1080,H=format==='story'?1920:format==='square'?1080:1350;
 can.width=W;can.height=H;can.style.aspectRatio=W+'/'+H;
 const ctx=can.getContext('2d');if(!ctx)return;
 const p=style==='rosas'?['#381b2b','#794151','#e6beb0']:style==='noite'?['#17131f','#30253a','#d4bfd7']:['#281e2a','#674054','#e7c4b8'];
 const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,p[0]);g.addColorStop(1,p[1]);
 ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.globalAlpha=.6;ctx.strokeStyle=p[2];ctx.lineWidth=3;ctx.strokeRect(55,55,W-110,H-110);ctx.strokeRect(76,76,W-152,H-152);ctx.globalAlpha=1;
 ctx.textAlign='center';ctx.fillStyle=p[2];ctx.font='32px Georgia';ctx.fillText('✧',W/2,145);ctx.font='26px Georgia';ctx.fillText('ENTRE AS LINHAS · MS. ADDAMS',W/2,215);
 let sz=68,lines=[];
 do{ctx.font='italic '+sz+'px Georgia';lines=wrap(ctx,'“'+phrase+'”',W-250);if(lines.length*sz*1.5<H*.46||sz<=32)break;sz-=3;}while(true);
 const LH=sz*1.5,start=H*.49-(lines.length-1)*LH/2;ctx.fillStyle='#fff2e5';
 lines.forEach((line,i)=>ctx.fillText(line,W/2,start+i*LH));
 const chapter=chapters.find(c=>c.slug===$('studio-chapter').value);
 ctx.fillStyle=p[2];ctx.font='italic 35px Georgia';ctx.fillText('— Ms. Addams',W/2,H-210);
 if(chapter){ctx.font='26px Georgia';ctx.fillText(chapter.title.slice(0,57),W/2,H-157);}
 ctx.font='25px Georgia';ctx.fillText('msaddams.com',W/2,H-111);
 $('studio-download').disabled=false;msg('studio-feedback','Cartão pronto: '+W+' × '+H+' pixels.');
}
$('studio-create')?.addEventListener('click',studioCreate);
$('studio-download')?.addEventListener('click',()=>{
 $('studio-canvas').toBlob(blob=>{
  if(!blob){msg('studio-feedback','Falha ao criar PNG.',true);return;}
  const url=URL.createObjectURL(blob),link=node('a');
  link.href=url;link.download='ms-addams-instagram.png';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
 },'image/png');
});
document.querySelectorAll('[data-tab]').forEach(t=>{
 if(t.dataset.tab==='authornotes')t.addEventListener('click',listNotes);
 if(t.dataset.tab==='studio')t.addEventListener('click',studioLoad);
 if(t.dataset.tab==='insights')t.addEventListener('click',insights);
});
})();
