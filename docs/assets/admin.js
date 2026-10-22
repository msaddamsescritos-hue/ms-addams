
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  // Remove apenas o parâmetro de divulgação indesejado da barra de endereços.
  try {
    const pageUrl = new URL(window.location.href);
    if (pageUrl.searchParams.get('utm_source') === 'chatgpt.com') {
      pageUrl.searchParams.delete('utm_source');
      window.history.replaceState(window.history.state, '', pageUrl.pathname + pageUrl.search + pageUrl.hash);
    }
  } catch (_) { /* navegação continua normalmente */ }
  const cfg = window.ADDAMS_CONFIG || {};
  const functionUrl = name => `${String(cfg.supabaseUrl || '').replace(/\/$/, '')}/functions/v1/${name}`;
  const configured = Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey && window.supabase);
  const client = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey) : null;
  let chapters = [], letters = [], currentLetter = null, submitIntent = 'draft';
  const escapeHtml = v => String(v || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function status(id, msg, error = false) { const el = $(id); el.textContent = msg; el.className = `form-feedback ${error ? 'error' : 'success'}`; }
  const clean = text => String(text || '').trim();
  function slugify(text) { return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 88); }
  const timestamp = value => value ? new Date(value).toLocaleString('pt-BR') : '—';
  async function guard() {
    if (!client) { status('login-feedback', 'Falta configurar o projeto Supabase em assets/config.js. Veja o LEIA-ME do projeto.', true); return; }
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) { showLogin(); return; }
    const { data, error: adminError } = await client.from('site_admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (adminError || !data) { await client.auth.signOut(); status('login-feedback', 'Esta conta não foi autorizada como administradora.', true); showLogin(); return; }
    $('login-layout').classList.add('hidden'); $('dashboard').classList.remove('hidden');
    await Promise.all([loadChapters(), loadLetters(), loadTraffic()]);
  }
  async function loadTraffic() {
    const feedback = $('traffic-feedback');
    if (!feedback) return;
    feedback.className = 'traffic-feedback';
    feedback.textContent = 'Consultando as estatísticas…';
    const {data, error} = await client.rpc('get_site_visit_stats');
    if (error) {
      feedback.className = 'traffic-feedback error';
      feedback.textContent = 'Não foi possível carregar as visitas. Execute o arquivo db/estatisticas-visitas.sql no SQL Editor do Supabase. Detalhe: ' + error.message;
      return;
    }
    const format = value => new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
    $('visits-today').textContent = format(data.today);
    $('visits-week').textContent = format(data.week);
    $('visits-total').textContent = format(data.total);
    const graph = $('traffic-chart'); graph.replaceChildren();
    const days = Array.isArray(data.days) ? data.days : [];
    const max = Math.max(1, ...days.map(day => Number(day.count) || 0));
    if (!days.length) {
      const empty = document.createElement('span'); empty.className='traffic-placeholder'; empty.textContent = 'Nenhum dado registrado.'; graph.append(empty);
    } else {
      for (const day of days) {
        const count = Math.max(0, Number(day.count) || 0);
        const item = document.createElement('div'); item.className = 'traffic-day'; item.title = `${day.label}: ${format(count)} visita(s)`;
        const number = document.createElement('span'); number.className = 'traffic-value'; number.textContent = format(count);
        const track = document.createElement('div'); track.className = 'traffic-bar-track';
        const bar = document.createElement('span'); bar.className = 'traffic-bar'; bar.style.height = `${Math.max(2,Math.round(100 * count / max))}%`; track.append(bar);
        const label = document.createElement('span'); label.className = 'traffic-day-label'; label.textContent = String(day.label || '');
        item.append(number,track,label); graph.append(item);
      }
    }
    graph.setAttribute('aria-label', `Visitas nos últimos sete dias: ${days.map(day => `${day.label}: ${day.count}`).join(', ')}`);
    feedback.textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) + '.';
  }
  function showLogin() { $('dashboard').classList.add('hidden'); $('login-layout').classList.remove('hidden'); }
  async function loadChapters() {
    const { data, error } = await client.from('chapters').select('*').order('number', { ascending: true });
    if (error) { $('manuscript-list').textContent = `Erro ao carregar manuscritos: ${error.message}`; return; }
    chapters = data || [];
    $('count-published').textContent = chapters.filter(c => c.published).length;
    $('count-draft').textContent = chapters.filter(c => !c.published).length;
    const list = $('manuscript-list'); list.replaceChildren();
    if (!chapters.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'Ainda não há capítulos. Clique em “Novo capítulo” para começar.'; list.append(empty); return; }
    chapters.forEach(c => {
      const row = document.createElement('div'); row.className = 'admin-row';
      const summary = document.createElement('div');
      summary.innerHTML = `<p>CAPÍTULO ${String(c.number).padStart(2,'0')} · ${c.published ? 'PUBLICADO' : 'RASCUNHO'}</p><h3>${escapeHtml(c.title)}</h3><p>Atualizado: ${timestamp(c.updated_at)}</p>`;
      const actions = document.createElement('div'); actions.className = 'actions';
      const pill = document.createElement('span'); pill.className = `status-pill ${c.published ? '' : 'draft'}`; pill.textContent = c.published ? 'Público' : 'Privado';
      const edit = document.createElement('button'); edit.className = 'outline-btn'; edit.type = 'button'; edit.textContent = 'Editar'; edit.addEventListener('click', () => editChapter(c.id));
      actions.append(pill, edit);
      if (c.published) { const link = document.createElement('a'); link.className = 'outline-btn'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Ver no site'; link.href = `../capitulo.html?slug=${encodeURIComponent(c.slug)}`; actions.append(link); }
      row.append(summary, actions); list.append(row);
    });
  }
  function resetEditor(c) {
    $('editor-block').classList.remove('hidden');
    $('chapter-id').value = c?.id || '';
    $('chapter-number').value = c?.number || (Math.max(0, ...chapters.map(x => x.number)) + 1);
    $('chapter-title').value = c?.title || '';
    $('chapter-epigraph').value = c?.epigraph || '';
    $('chapter-body').value = c?.body || '';
    $('chapter-slug').value = c?.slug || '';
    $('editor-title').textContent = c ? `Editar · Capítulo ${c.number}` : 'Novo capítulo';
    $('delete-chapter').classList.toggle('hidden', !c);
    $('chapter-feedback').textContent = '';
    $('editor-block').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function editChapter(id) { const c = chapters.find(x => String(x.id) === String(id)); if (c) resetEditor(c); }
  function formChapter(published) {
    const number = Number($('chapter-number').value);
    const title = clean($('chapter-title').value);
    const body = clean($('chapter-body').value);
    const epigraph = clean($('chapter-epigraph').value);
    const existingId = $('chapter-id').value;
    const existing = chapters.find(c => String(c.id) === String(existingId));
    return {
      number,
      title, body, epigraph,
      slug: existing?.slug || `capitulo-${number}-${slugify(title)}`,
      published,
      published_at: published ? (existing?.published_at || new Date().toISOString()) : null
    };
  }
  async function saveChapter(published) {
    const form = $('chapter-form'); if (!form.reportValidity()) return;
    const chapter = formChapter(published);
    if (!chapter.title || !chapter.body || !Number.isInteger(chapter.number) || chapter.number < 1) { status('chapter-feedback', 'Preencha corretamente o número, título e conteúdo.', true); return; }
    status('chapter-feedback', 'Salvando manuscrito…');
    const id = $('chapter-id').value;
    const request = id ? client.from('chapters').update(chapter).eq('id', id).select().single() : client.from('chapters').insert(chapter).select().single();
    const { data, error } = await request;
    if (error) { status('chapter-feedback', `Não foi possível salvar: ${error.message}`, true); return; }
    await loadChapters(); resetEditor(data);
    status('chapter-feedback', published ? 'Capítulo publicado! Já pode ser lido na biblioteca.' : 'Rascunho salvo com segurança. Não aparece para leitores.');
  }
  async function deleteChapter() {
    const id = $('chapter-id').value;
    if (!id) return;
    const c = chapters.find(c => String(c.id) === String(id));
    if (!window.confirm(`Excluir permanentemente “${c?.title || 'este capítulo'}”? Esta ação não pode ser desfeita.`)) return;
    const { error } = await client.from('chapters').delete().eq('id', id);
    if (error) { status('chapter-feedback', error.message, true); return; }
    $('editor-block').classList.add('hidden'); await loadChapters();
  }
  function switchTab(which) {
    for (const t of ['manuscripts','letters']) {
      const selected = which === t;
      $(`tab-${t}`).classList.toggle('active', selected);
      $(`tab-${t}`).setAttribute('aria-selected', String(selected));
      $(`section-${t}`).classList.toggle('hidden', !selected);
    }
  }
  async function loadLetters() {
    const { data, error } = await client.from('letters').select('id,alias,email,message,status,created_at,replied_at,reply_text').order('created_at', {ascending:false}).limit(200);
    if (error) { $('letters-list').textContent = `Erro ao ler cartas: ${error.message}`; return; }
    letters = data || [];
    $('count-letters').textContent = letters.filter(x => x.status !== 'replied').length;
    const list = $('letters-list'); list.replaceChildren();
    if (!letters.length) { const el = document.createElement('p'); el.className = 'empty-state'; el.textContent = 'Ainda não há cartas recebidas.'; list.append(el); return; }
    letters.forEach(l => {
      const row = document.createElement('div'); row.className = 'admin-row';
      const summary = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = l.alias || 'Sem pseudônimo';
      const metadata = document.createElement('p'); metadata.textContent = `${timestamp(l.created_at)} · ${l.status === 'replied' ? 'Respondida' : l.status === 'sending' ? 'Enviando' : 'Aguardando resposta'}`;
      const preview = document.createElement('p'); preview.textContent = clean(l.message).slice(0,115) + (l.message?.length > 115 ? '…' : '');
      summary.append(title,metadata,preview);
      const action = document.createElement('button'); action.className = 'outline-btn'; action.type = 'button'; action.textContent = 'Abrir carta'; action.addEventListener('click', () => openLetter(l.id));
      row.append(summary,action); list.append(row);
    });
  }
  function openLetter(id) {
    currentLetter = letters.find(x => x.id === id);
    if (!currentLetter) return;
    $('letter-heading').textContent = `Carta de ${currentLetter.alias}`;
    $('letter-meta').textContent = `Recebida em ${timestamp(currentLetter.created_at)} · Responder para: ${currentLetter.email}`;
    $('letter-message').textContent = currentLetter.message;
    $('reply-body').value = currentLetter.reply_text || '';
    const answered = currentLetter.status === 'replied';
    $('send-reply').disabled = answered || currentLetter.status === 'sending';
    $('send-reply').textContent = answered ? 'Carta já respondida' : currentLetter.status === 'sending' ? 'Envio em andamento' : 'Preparar resposta no Gmail →';
    $('reply-feedback').textContent = answered ? `Resposta enviada em ${timestamp(currentLetter.replied_at)}.` : '';
    $('letter-detail').classList.remove('hidden'); $('letters-list').classList.add('hidden');
    $('letter-detail').scrollIntoView({behavior:'smooth'});
  }
  async function replyLetter(event) {
    event.preventDefault();
    if (!currentLetter) return;
    const body = clean($('reply-body').value);
    if (body.length < 2 || body.length > 10000) { status('reply-feedback', 'A resposta deve conter entre 2 e 10.000 caracteres.', true); return; }
    const recipient = clean(currentLetter.email);
    if (!recipient || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(recipient)) {
      status('reply-feedback', 'Esta carta não tem um e-mail válido para resposta.', true);
      return;
    }
    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('authuser', 'msaddams.escritos@gmail.com');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('fs', '1');
    gmailUrl.searchParams.set('to', recipient);
    gmailUrl.searchParams.set('su', 'Uma resposta de Ms. Addams');
    gmailUrl.searchParams.set('body', body + '\\n\\nCom carinho,\\nMs. Addams');
    const link = document.createElement('a');
    link.href = gmailUrl.toString();
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    status('reply-feedback', 'Gmail solicitado. Confira a conta remetente e clique em Enviar no Gmail. Esta carta continuará pendente no gabinete; abrir o Gmail não confirma o envio.');
  }
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault(); if (!client) return;
    const email = $('login-form').elements.namedItem('email').value.trim(); const password = $('login-form').elements.namedItem('password').value;
    status('login-feedback','Verificando credenciais…');
    const { error } = await client.auth.signInWithPassword({email,password});
    if (error) { status('login-feedback', 'Login não autorizado. Confira seu e-mail e sua senha.', true); return; }
    $('login-form').elements.namedItem('password').value = ''; await guard();
  });
  $('logout').addEventListener('click',async()=>{await client.auth.signOut();showLogin();});
  $('new-chapter').addEventListener('click',()=>resetEditor(null));
  $('close-editor').addEventListener('click',()=>$('editor-block').classList.add('hidden'));
  $('chapter-title').addEventListener('input',()=>{if (!$('chapter-id').value) $('chapter-slug').value = `capitulo-${$('chapter-number').value}-${slugify($('chapter-title').value)}`;});
  $('chapter-number').addEventListener('input',()=>{if (!$('chapter-id').value) $('chapter-slug').value = `capitulo-${$('chapter-number').value}-${slugify($('chapter-title').value)}`;});
  $('chapter-form').querySelectorAll('button[type="submit"]').forEach(btn => btn.addEventListener('click',() => {submitIntent = btn.dataset.action;}));
  $('chapter-form').addEventListener('submit',e=>{e.preventDefault();saveChapter(submitIntent==='publish');});
  $('delete-chapter').addEventListener('click',deleteChapter);
  $('preview-chapter').addEventListener('click',()=>{
    const c = formChapter(false);
    const popup = window.open('', '_blank');
    if (!popup) { status('chapter-feedback', 'Autorize a abertura de janela para visualizar a prévia.', true); return; }
    popup.document.write(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Prévia privada · ${escapeHtml(c.title)}</title><meta name="robots" content="noindex"><body style="max-width:760px;margin:60px auto;padding:0 25px;background:#f3ecdf;color:#382d34;font:24px/1.6 Georgia"><p style="color:#765766;font:12px Arial">PRÉVIA PRIVADA · AINDA NÃO PUBLICADO</p><h1>${escapeHtml(c.title)}</h1><p><i>${escapeHtml(c.epigraph)}</i></p>${c.body.split(/\n\s*\n/).map(p=>`<p style="white-space:pre-wrap">${escapeHtml(p)}</p>`).join('')}<p>— Ms. Addams</p></body></html>`);
    popup.document.close();
  });
  $('refresh-traffic').addEventListener('click',loadTraffic);
  $('refresh-letters').addEventListener('click',loadLetters);
  $('close-letter').addEventListener('click',()=>{$('letter-detail').classList.add('hidden');$('letters-list').classList.remove('hidden');});
  $('reply-form').addEventListener('submit',replyLetter);
  $('delete-letter').addEventListener('click', async () => {
    if (!currentLetter || !window.confirm('Excluir permanentemente esta carta e a resposta armazenada? Esta ação não pode ser desfeita.')) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) { status('reply-feedback', 'Faça login novamente.', true); return; }
    $('delete-letter').disabled = true;
    try {
      const res = await fetch(functionUrl('delete-letter'), {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({letterId:currentLetter.id})
      });
      const out = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(out.error || 'Falha na exclusão.');
      currentLetter = null;
      $('letter-detail').classList.add('hidden');
      $('letters-list').classList.remove('hidden');
      await loadLetters();
    } catch(err) { status('reply-feedback',err.message || 'Erro ao excluir.',true); }
    finally { $('delete-letter').disabled = false; }
  });
  document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click',()=>switchTab(tab.dataset.tab)));
  if (client) client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') showLogin(); });
  guard();
})();
