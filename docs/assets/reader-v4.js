/* Ms. Addams · leitura 4.0 — progresso, reações e versos guardados.
 * Não coleta nomes, IP ou e-mails. A contagem representa sessões anônimas.
 */
(()=>{
'use strict';
if(document.body.dataset.page!=='chapter')return;
const cfg=window.ADDAMS_CONFIG||{};
const db=window.supabase&&cfg.supabaseUrl&&cfg.supabasePublishableKey?
 window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null;
const root=document.getElementById('chapter-content');
if(!root)return;
const slug=new URLSearchParams(window.location.search).get('slug')||'';
if(!/^[a-z0-9-]{1,140}$/.test(slug))return;
const el=(tag,cls,value)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(value!==undefined)n.textContent=String(value);return n;
};
const keyFor=(name)=>'msaddams_'+name+':'+slug;
let ready=false,ending=null,progressSent=-1,pending=null,writeTimer=null,sessionToken=null;
const safeGet=k=>{try{return window.localStorage.getItem(k)}catch{return null}};
const safeSet=(k,v)=>{try{window.localStorage.setItem(k,v)}catch(_){}};
function getSession(){
 if(sessionToken)return sessionToken;
 const key=keyFor('reading_session_v4');
 try {
   const old=window.sessionStorage.getItem(key);
   if(old && /^[0-9a-f-]{36}$/i.test(old)){sessionToken=old;return old;}
 }catch(_){}
 sessionToken=crypto.randomUUID();
 try{window.sessionStorage.setItem(key,sessionToken)}catch(_){}
 return sessionToken;
}
function isAuthor(){
 try{return localStorage.getItem('msaddams_owner_visit_exclusion_v1')==='1'}
 catch{return false}
}
function scheduleProgress(state){
 if(!db||isAuthor()||!state||state.slug!==slug||state.index<=0)return;
 const percent=Number(state.percent);
 if(!Number.isFinite(percent)||percent<0||percent>100||percent<=progressSent)return;
 pending={p_slug:slug,p_session:getSession(),p_percent:percent,p_completed:Boolean(state.completed)};
 if(writeTimer)clearTimeout(writeTimer);
 writeTimer=setTimeout(flushProgress,380);
}
async function flushProgress(){
 if(!pending||!db)return;
 const payload=pending;pending=null;writeTimer=null;
 const {error}=await db.rpc('track_chapter_progress_v4',payload);
 if(!error)progressSent=Math.max(progressSent,payload.p_percent);
}
document.addEventListener('msaddams:reader-page',event=>scheduleProgress(event.detail));
window.addEventListener('pagehide',()=>{
 if(writeTimer)clearTimeout(writeTimer);
 // Tentativa final: pode não completar se o navegador encerrar a rede.
 if(pending)flushProgress();
},{once:true});
const quotesKey='msaddams_quotes_v4';
function archiveText(){
 const paper=root.querySelector('.reading-paper');
 const sel=window.getSelection();
 if(!sel||sel.isCollapsed||!sel.rangeCount||!paper||
    !paper.contains(sel.anchorNode)||!paper.contains(sel.focusNode)){
    return {error:'Selecione com o mouse ou com o dedo uma frase do manuscrito.'};
 }
 const phrase=sel.toString().replace(/\s+/g,' ').trim();
 if(phrase.length<12)return {error:'Selecione um trecho de pelo menos 12 caracteres.'};
 if(phrase.length>420)return {error:'Escolha um trecho menor, com até 420 caracteres.'};
 return {text:phrase};
}
function saveQuote(){
 const chosen=archiveText();
 const notice=document.getElementById('reader-quote-feedback');
 if(chosen.error){if(notice)notice.textContent=chosen.error;return;}
 const title=root.querySelector('.reading-header h1')?.textContent?.trim()||'Um manuscrito';
 let saved=[];
 try{const records=JSON.parse(localStorage.getItem(quotesKey)||'[]');if(Array.isArray(records))saved=records}catch(_){}
 const duplicate=saved.some(q=>q.slug===slug&&q.text===chosen.text);
 if(duplicate){if(notice)notice.textContent='Esse trecho já está guardado no seu arquivo particular.';return;}
 saved.unshift({slug,title,text:chosen.text,savedAt:Date.now()});
 try{localStorage.setItem(quotesKey,JSON.stringify(saved.slice(0,75)));
   if(notice)notice.textContent='♡ Trecho guardado neste navegador, sem cadastro.';
 }catch(_){if(notice)notice.textContent='O navegador não permitiu guardar o trecho.';}
}
async function readReactions(){
 if(!db||!ending)return;
 const {data,error}=await db.rpc('chapter_reaction_totals_v4',{p_slug:slug});
 const group=ending.querySelector('.v4-reaction-group');
 if(!group)return;
 if(error){
   group.replaceChildren(el('p','v4-soft-note','As reações serão ativadas após a atualização da biblioteca.'));
   return;
 }
 const counts=Object.fromEntries((data||[]).map(r=>[r.reaction,Number(r.total)||0]));
 group.querySelectorAll('button[data-reaction]').forEach(button=>{
   const reaction=button.dataset.reaction;
   const label=button.dataset.label;
   button.textContent=label+' · '+(counts[reaction]||0).toLocaleString('pt-BR');
   button.classList.toggle('v4-voted',safeGet(keyFor('reaction_choice_v4'))===reaction);
 });
}
async function vote(reaction){
 if(!db)return;
 const group=ending.querySelector('.v4-reaction-group');
 if(!group)return;
 group.querySelectorAll('button').forEach(b=>b.disabled=true);
 const voteKey=keyFor('reaction_uuid_v4');
 let token=safeGet(voteKey);
 if(!/^[0-9a-f-]{36}$/i.test(token||'')){token=crypto.randomUUID();safeSet(voteKey,token)}
 const {error}=await db.rpc('vote_chapter_reaction_v4',{
  p_slug:slug,p_vote:token,p_reaction:reaction
 });
 group.querySelectorAll('button').forEach(b=>b.disabled=false);
 const feedback=ending.querySelector('.v4-reaction-feedback');
 if(error){
   if(feedback)feedback.textContent='Não foi possível registrar sua reação. Tente mais tarde.';
   return;
 }
 safeSet(keyFor('reaction_choice_v4'),reaction);
 if(feedback)feedback.textContent='Obrigada por deixar um pedacinho da sua leitura nas entrelinhas.';
 await readReactions();
}
const FEELINGS={
 amor:'amor',amizade:'amizade',desilusoes:'decepções',
 recomecos:'recomeços',autoconhecimento:'autoconhecimento',outros:'histórias'
};
async function fillEnding(){
 if(!ending)return;
 const title=root.querySelector('.reading-header h1')?.textContent||'Este manuscrito';
 let theme='outros',note='';
 if(db){
   const {data,error}=await db.from('chapters').select('feeling_theme,closing_note').eq('slug',slug).maybeSingle();
   if(!error&&data){theme=window.ADDAMS_FEELINGS?.effective({...data,title}) || data.feeling_theme || theme;note=data.closing_note||'';}
 }
 const paragraph=ending.querySelector('.reader-ending-text');
 if(paragraph)paragraph.textContent=note.trim()||
   'Talvez esta história tenha terminado. Mas algumas perguntas continuam conosco depois que fechamos o livro.';
 const content=el('div','v4-ending-content');
 content.append(el('h3','','O que esta história despertou em você?'));
 content.append(el('p','v4-soft-note','Reaja sem nome, e-mail ou cadastro. Uma escolha por navegador e capítulo.'));
 const group=el('div','v4-reaction-group');
 const list=[['identificacao','♡ Me identifiquei'],['reflexao','✧ Me fez refletir'],['acolhimento','✦ Precisava ler isso']];
 for(const [key,label]of list){
   const b=el('button','v4-reaction-button',label);
   b.type='button';b.dataset.reaction=key;b.dataset.label=label;
   b.addEventListener('click',()=>vote(key));group.append(b);
 }
 content.append(group,el('p','v4-reaction-feedback',''));
 const related=el('div','v4-related-stories');
 related.append(el('h3','','Outros manuscritos para descobrir'));
 const links=el('div','v4-related-links');
 related.append(links);
 content.append(related);
 ending.querySelector('.reader-ending-engagement')?.append(content);
 await readReactions();
 if(!db)return;
 const {data,error}=await db.from('chapters')
  .select('number,slug,title,feeling_theme,published,scheduled_at')
  .or('and(published.eq.true,scheduled_at.is.null),scheduled_at.lte.'+new Date().toISOString())
  .order('number',{ascending:true});
 if(error){links.append(el('p','v4-soft-note','Descubra outras histórias na biblioteca.'));return;}
 const others=(data||[]).filter(c=>c.slug!==slug);
 const categoryFor=c=>window.ADDAMS_FEELINGS?.effective(c)||c.feeling_theme||'outros';
 const same=others.filter(c=>categoryFor(c)===theme);
 const suggested=[...same,...others.filter(c=>categoryFor(c)!==theme)].slice(0,2);
 if(!suggested.length){links.append(el('p','v4-soft-note','Outras histórias ainda estão sendo escritas.'));return;}
 for(const ch of suggested){
   const link=el('a','v4-related-link',ch.title+' ↗');
   link.href='capitulo.html?slug='+encodeURIComponent(ch.slug);
   links.append(link);
 }
 const desc=el('p','v4-soft-note','Sugestões relacionadas a '+(FEELINGS[theme]||'outras histórias')+'.');
 related.append(desc);
}
function initReader(paper){
 if(ready)return;
 ready=true;ending=paper.querySelector('.reader-ending-page');
 if(!ending)return;
 const toolbar=paper.previousElementSibling?.classList?.contains('manuscript-toolbar')?
    paper.previousElementSibling:null;
 if(toolbar){
   const save=el('button','manuscript-button v4-save-quote','♡ Guardar trecho');
   save.type='button';save.addEventListener('click',saveQuote);
   const archive=el('a','manuscript-button v4-quotes-link','Meus trechos ↗');
   archive.href='meus-trechos.html';
   const feedback=el('span','manuscript-hint','');
   feedback.id='reader-quote-feedback';feedback.setAttribute('aria-live','polite');
   toolbar.append(save,archive,feedback);
 }
 fillEnding();
 if(window.ADDAMS_READER_STATE)scheduleProgress(window.ADDAMS_READER_STATE);
}
const existing=root.querySelector('.reading-paper.real-page-turn .reader-ending-page');
if(existing)initReader(existing.closest('.reading-paper'));
else{
 const observer=new MutationObserver(()=>{
   const paper=root.querySelector('.reading-paper.real-page-turn');
   if(paper?.querySelector('.reader-ending-page')){observer.disconnect();initReader(paper)}
 });
 observer.observe(root,{subtree:true,childList:true});
}
})();
