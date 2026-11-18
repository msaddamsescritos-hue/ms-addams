/* Ms. Addams — Gabinete 4.0 | Radar de leitura e correspondências. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),cfg=window.ADDAMS_CONFIG||{};
if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;
const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const make=(tag,cls,value)=>{
 const el=document.createElement(tag);if(cls)el.className=cls;
 if(value!==undefined)el.textContent=String(value);return el;
};
const fmt=n=>Number(n||0).toLocaleString('pt-BR');
const status=(id,value,failed=false)=>{const el=$(id);if(el){el.textContent=value;el.style.color=failed?'#e8a6b0':'#d8c5cd';}};
let activeLetter=null;
const createMetric=(name,value)=>{
 const item=make('div','v3-summary-metric');
 item.append(make('span','',name),make('strong','',value));
 return item;
};
function milestone(label,count,total){
 const line=make('div','v4-radar-milestone');
 const title=make('span','',label);
 const meter=make('div','v4-radar-track'),fill=make('span','');
 fill.style.width=String(total?Math.round(100*count/total):0)+'%';
 fill.setAttribute('aria-hidden','true');meter.append(fill);
 const value=make('b','',fmt(count));
 line.append(title,meter,value);return line;
}
async function loadRadar(){
 const box=$('reader-radar'),summary=$('reader-radar-summary');if(!box||!summary)return;
 box.replaceChildren();summary.replaceChildren();
 status('reader-radar-feedback','Consultando o histórico de leitura...');
 const {data,error}=await client.rpc('chapter_engagement_summary_v4');
 if(error){
   status('reader-radar-feedback','Radar aguardando a atualização db/biblioteca-v4.sql no Supabase. Os registros de progresso começam após a ativação.',true);
   box.append(make('p','v3-quiet','Os totais de abertura da Biblioteca 3.0 continuam disponíveis acima.'));
   return;
 }
 const rows=Array.isArray(data)?data:[];
 const starts=rows.reduce((a,c)=>a+Number(c.started_count||0),0);
 const ends=rows.reduce((a,c)=>a+Number(c.completed_count||0),0);
 const reactions=rows.reduce((a,c)=>a+Number(c.identification_count||0)+Number(c.reflection_count||0)+Number(c.comfort_count||0),0);
 summary.append(createMetric('Sessões iniciadas',fmt(starts)));
 summary.append(createMetric('Chegaram ao final',fmt(ends)));
 summary.append(createMetric('Conclusão estimada',starts?Math.round(100*ends/starts)+'%':'—'));
 summary.append(createMetric('Reações anônimas',fmt(reactions)));
 if(!rows.length)box.append(make('p','v3-quiet','Ainda não há manuscritos.'));
 for(const row of rows){
  const total=Number(row.started_count)||0,finished=Number(row.completed_count)||0;
  const card=make('article','v4-radar-card');
  card.append(make('h3','',row.chapter_title));
  const headline=make('p','v4-radar-headline',fmt(total)+' sessões de leitura iniciadas · '+fmt(finished)+' chegaram ao final');
  card.append(headline);
  const chart=make('div','v4-radar-chart');
  chart.append(milestone('Iniciaram',total,total));
  chart.append(milestone('25% do texto',Number(row.reached_25)||0,total));
  chart.append(milestone('50% do texto',Number(row.reached_50)||0,total));
  chart.append(milestone('75% do texto',Number(row.reached_75)||0,total));
  chart.append(milestone('Encerramento',finished,total));
  card.append(chart);
  card.append(make('p','v4-radar-footnote',fmt(Number(row.below_half)||0)+' sessão(ões) têm último progresso registrado abaixo da metade; algumas podem estar em andamento.'));
  const last=make('div','v4-last-positions');
  last.append(make('h4','','Última posição registrada'));
  const stages=[['Antes de 25%',row.last_0_24],['Entre 25% e 49%',row.last_25_49],
   ['Entre 50% e 74%',row.last_50_74],['Entre 75% e 99%',row.last_75_99]];
  const stageList=make('div','v4-last-grid');
  stages.forEach(([label,value])=>{
    const item=make('span','v4-last-pill');
    item.append(make('span','',label),make('strong','',fmt(value)));
    stageList.append(item);
  });
  last.append(stageList,make('p','v4-radar-footnote','Essa é a última posição observada, não uma confirmação de abandono da leitura.'));
  card.append(last);
  const reactionRow=make('div','v4-radar-reactions');
  [['Me identifiquei',row.identification_count],['Me fez refletir',row.reflection_count],['Precisava ler',row.comfort_count]]
   .forEach(([label,count])=>{
      const pill=make('span','v4-radar-pill',label+': '+fmt(count));reactionRow.append(pill);
    });
  card.append(reactionRow);box.append(card);
 }
 status('reader-radar-feedback','Valores acumulados desde a ativação do Radar; uma sessão não corresponde a uma pessoa única.');
}
$('refresh-chapter-insights')?.addEventListener('click',loadRadar);
$('tab-insights')?.addEventListener('click',loadRadar);

// Correspondências privadas: somente e-mails iguais aparecem juntos.
// Não identificamos autores pela coincidência de pseudônimos.
document.addEventListener('msaddams:letter-opened',event=>{
 const detail=event.detail||{};
 if(!detail.id||!detail.email)return;
 activeLetter={id:detail.id,email:detail.email};
 if($('letter-topic'))$('letter-topic').value=detail.topic||'';
 status('letter-topic-feedback','');
 loadHistory(detail.email,detail.id);
});
async function loadHistory(email,currentId){
 const list=$('letter-history-list');if(!list)return;
 list.replaceChildren(make('p','v3-quiet','Consultando outras cartas enviadas deste endereço...'));
 const {data,error}=await client.from('letters')
  .select('id,alias,message,topic,status,reply_text,replied_at,created_at')
  .eq('email',email).order('created_at',{ascending:false}).limit(50);
 list.replaceChildren();
 if(error){
   list.append(make('p','v3-quiet','Não foi possível consultar o histórico privado.'));
   return;
 }
 const rows=data||[];
 if(!rows.length){list.append(make('p','v3-quiet','Não há correspondências anteriores deste endereço.'));return;}
 list.append(make('p','v3-quiet',rows.length+' carta(s) associada(s) a este e-mail. Apenas o Gabinete pode consultá-las.'));
 for(const record of rows){
   const item=make('details','v4-history-entry');
   if(record.id===currentId)item.classList.add('v4-history-current');
   const title=make('summary','',
    (record.id===currentId?'Carta atual · ':'')+
    new Date(record.created_at).toLocaleDateString('pt-BR')+
    ' · '+(record.topic||'Sem assunto')+' · '+(record.status==='replied'?'Respondida':'Pendente'));
   const body=make('p','v4-history-message',record.message);
   item.append(title,body);
   if(record.reply_text&&record.status==='replied'){
     item.append(make('p','v4-history-response-label','Resposta registrada'));
     item.append(make('p','v4-history-message',record.reply_text));
   }
   list.append(item);
 }
}
$('letter-topic-save')?.addEventListener('click',async()=>{
 if(!activeLetter){status('letter-topic-feedback','Abra uma carta antes de salvar.',true);return;}
 const topic=String($('letter-topic')?.value||'').trim();
 if(topic.length>80){status('letter-topic-feedback','Máximo de 80 caracteres.',true);return;}
 const button=$('letter-topic-save');button.disabled=true;
 const {error}=await client.rpc('set_letter_topic',{p_id:activeLetter.id,p_topic:topic});
 button.disabled=false;
 if(error){status('letter-topic-feedback','Não foi possível salvar. Execute db/biblioteca-v4.sql no Supabase.',true);return;}
 status('letter-topic-feedback','Assunto privado salvo. Já pode pesquisar por ele nas correspondências.');
 document.dispatchEvent(new CustomEvent('msaddams:letter-topic-saved',{detail:{id:activeLetter.id,topic}}));
 loadHistory(activeLetter.email,activeLetter.id);
});
})();
