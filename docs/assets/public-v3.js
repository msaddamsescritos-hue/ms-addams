/* Ms. Addams — personalização pública, próximo manuscrito e métricas anônimas. */
(()=>{
'use strict';
const cfg=window.ADDAMS_CONFIG||{};
if(!cfg.supabaseUrl||!cfg.supabasePublishableKey||!window.supabase)return;
const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const make=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;};
async function reveal(){
  const {data,error}=await db.rpc('next_manuscript_reveal');
  if(error||!data)return;
  const date=new Date(data);
  if(!Number.isFinite(date.getTime())||date.getTime()<=Date.now())return;
  const target=document.getElementById('biblioteca')||document.querySelector('main');
  if(!target)return;
  const box=make('aside','v3-next-reveal');
  box.append(make('span','v3-kicker','✧ EM BREVE, OUTRO MANUSCRITO'));
  box.append(make('h2','','Uma nova desventura será revelada.'));
  box.append(make('p','','A próxima página permanece selada até a data escolhida pela autora.'));
  const when=make('p','v3-when',date.toLocaleString('pt-BR',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}));
  box.append(when);
  const countdown=make('p','v3-countdown');
  box.append(countdown);
  function update(){
    const diff=Math.max(0,date.getTime()-Date.now()),days=Math.floor(diff/86400000),hours=Math.floor(diff/3600000)%24,minutes=Math.floor(diff/60000)%60;
    countdown.textContent=diff>0?(days?days+' dia(s), ':'')+hours+' hora(s) e '+minutes+' minuto(s) para a próxima página.':'O próximo manuscrito já pode estar disponível.';
  }
  update(); const interval=setInterval(update,60000);
  window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
  target.append(box);
}
async function enhanceChapter(){
 const slug=new URLSearchParams(window.location.search).get('slug');
 if(!slug)return;
 const root=document.getElementById('chapter-content');if(!root)return;
 let started=false;
 const apply=async paper=>{
   if(started)return;started=true;
   const {data}=await db.from('chapters').select('cover_theme,paper_theme').eq('slug',slug).maybeSingle();
   if(data?.cover_theme)paper.dataset.coverTheme=data.cover_theme;
   if(data?.paper_theme&&data.paper_theme!=='automatico')paper.dataset.paperTheme=data.paper_theme;
   // Uma leitura por sessão do navegador e por capítulo. Nunca armazena IP no banco.
   try{
     if(localStorage.getItem('msaddams_owner_visit_exclusion_v1')==='1')return;
     const key='msaddams_chapter_read_v3:'+slug;
     if(sessionStorage.getItem(key)==='1')return;
     const {error}=await db.rpc('record_chapter_read',{p_slug:slug});
     if(!error)sessionStorage.setItem(key,'1');
   }catch(_){/* leitura sempre continua */}
 };
 const now=root.querySelector('.reading-paper.real-page-turn');
 if(now){apply(now);return;}
 const observer=new MutationObserver(()=>{
   const paper=root.querySelector('.reading-paper.real-page-turn');
   if(paper){observer.disconnect();apply(paper);}
 });
 observer.observe(root,{childList:true,subtree:true});
}
if(document.body.dataset.page==='home')reveal();
if(document.body.dataset.page==='chapter')enhanceChapter();
})();
