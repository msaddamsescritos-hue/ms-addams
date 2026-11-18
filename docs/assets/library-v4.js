/* Ms. Addams — Biblioteca por sentimentos, sem substituir os favoritos existentes. */
(()=>{
'use strict';
if(document.body.dataset.page!=='home')return;
const cfg=window.ADDAMS_CONFIG||{},root=document.getElementById('chapters');
if(!root||!cfg.supabaseUrl||!cfg.supabasePublishableKey||!window.supabase)return;
const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const themes=[
 ['todos','Todos os sentimentos'],['amor','Amor'],['amizade','Amizade'],
 ['desilusoes','Decepções'],['recomecos','Recomeços'],
 ['autoconhecimento','Autoconhecimento'],['outros','Outras reflexões']
];
const selected=new Map();
let active='todos';
async function init(){
 const {data,error}=await client.from('chapters')
  .select('slug,feeling_theme,published,scheduled_at')
  .or('and(published.eq.true,scheduled_at.is.null),scheduled_at.lte.'+new Date().toISOString());
 if(error||!data?.length)return; // Migração ainda não instalada ou biblioteca vazia.
 for(const chapter of data)selected.set(chapter.slug,chapter.feeling_theme||'outros');
 const bar=el('div','v4-feelings');
 const header=el('div','v4-feelings-heading');
 header.append(el('strong','','✧ Descubra por sentimento'));
 const snippet=el('span','','Cada história guarda um pouco daquilo que sentimos.');
 header.append(snippet);bar.append(header);
 const controls=el('div','v4-feelings-controls');
 controls.setAttribute('role','group');
 controls.setAttribute('aria-label','Filtrar manuscritos por sentimento');
 const result=el('p','v4-feelings-status','');
 result.setAttribute('aria-live','polite');
 function apply(){
  let visible=0,found=0;
  for(const card of root.querySelectorAll('article.chapter-card')){
   const href=card.querySelector('a[href*="capitulo.html?slug="]')?.getAttribute('href');
   if(!href)continue;
   const slug=new URL(href,location.href).searchParams.get('slug');
   const theme=selected.get(slug)||'outros';
   found++;
   const show=active==='todos'||theme===active;
   card.hidden=!show;
   if(show)visible++;
  }
  const label=themes.find(x=>x[0]===active)?.[1]||'Todos os sentimentos';
  result.textContent=found?(visible+' manuscrito(s) exibido(s) · '+label+
    (visible?'':' · Experimente outro sentimento ou desative o filtro de favoritos.')):'Aguardando biblioteca...';
 }
 for(const [value,label] of themes){
  const button=el('button','v4-feeling-chip',label);
  button.type='button';button.dataset.feeling=value;
  button.setAttribute('aria-pressed',String(value===active));
  button.addEventListener('click',()=>{
   active=value;
   controls.querySelectorAll('button').forEach(b=>{
    b.setAttribute('aria-pressed',String(b.dataset.feeling===active));
   });
   apply();
  });
  controls.append(button);
 }
 bar.append(controls,result);
 root.parentElement.insertBefore(bar,root);
 const obs=new MutationObserver(apply);
 obs.observe(root,{childList:true});
 document.addEventListener('msaddams:favorites-changed',()=>requestAnimationFrame(apply));
 apply();
}
init();
})();
