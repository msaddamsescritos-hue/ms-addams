
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
  let preparedLetterHtml = '', preparedLetterPlain = '';
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
    // Somente uma sessão verificada como administradora ativa a exclusão neste navegador.
    try { window.localStorage.setItem('msaddams_owner_visit_exclusion_v1', '1'); } catch (_) {}
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
  // Filtros e busca são locais: nenhuma carta é alterada ao pesquisar.
  function renderLetters() {
    const list = $('letters-list'); list.replaceChildren();
    const filter = $('letter-filter').value;
    const search = clean($('letter-search').value).toLocaleLowerCase('pt-BR');
    const filtered = letters.filter(l => {
      const matchesStatus = filter === 'all' || (filter === 'replied' ? l.status === 'replied' : l.status !== 'replied');
      const haystack = [l.alias, l.email, l.message].join(' ').toLocaleLowerCase('pt-BR');
      return matchesStatus && (!search || haystack.includes(search));
    });
    $('letter-filter-count').textContent = `${filtered.length} de ${letters.length} cartas exibidas`;
    if (!filtered.length) {
      const empty = document.createElement('p'); empty.className = 'empty-state';
      empty.textContent = letters.length ? 'Nenhuma carta corresponde à pesquisa ou ao filtro.' : 'Ainda não há cartas recebidas.';
      list.append(empty); return;
    }
    filtered.forEach(l => {
      const row = document.createElement('div'); row.className = 'admin-row';
      const summary = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = l.alias || 'Sem pseudônimo';
      const metadata = document.createElement('p');
      metadata.textContent = `${timestamp(l.created_at)} · ${l.status === 'replied' ? 'Respondida' : l.status === 'sending' ? 'Envio em andamento' : 'Pendente'}`;
      const preview = document.createElement('p');
      preview.textContent = clean(l.message).slice(0,115) + (l.message?.length > 115 ? '…' : '');
      summary.append(title, metadata, preview);
      const action = document.createElement('button'); action.className = 'outline-btn';
      action.type = 'button'; action.textContent = 'Abrir carta';
      action.addEventListener('click', () => openLetter(l.id));
      row.append(summary, action); list.append(row);
    });
  }
  async function loadLetters() {
    const { data, error } = await client.from('letters').select('id,alias,email,message,status,created_at,replied_at,reply_text').order('created_at', {ascending:false}).limit(200);
    if (error) { $('letters-list').textContent = `Erro ao ler cartas: ${error.message}`; return; }
    letters = data || [];
    $('count-letters').textContent = letters.filter(x => x.status !== 'replied').length;
    renderLetters();
  }
  const letterTemplates = {
    gentle: 'Recebi suas palavras com atenção. Obrigada por confiar a mim um pouco da sua história.\n\n',
    reflective: 'Há perguntas que não encontram respostas imediatas, mas merecem ser acolhidas. Ao ler sua carta, pensei em algo que gostaria de compartilhar:\n\n',
    discreet: 'Algumas histórias pedem delicadeza, e a sua merece ser recebida com respeito.\n\n',
    grateful: 'Agradeço por dedicar um pouco do seu tempo para me escrever. Sua mensagem chegou até mim e foi lida com carinho.\n\n'
  };
  async function confirmLetterSent() {
    if (!currentLetter || currentLetter.status !== 'new') return;
    const body = clean($('reply-body').value);
    if (body.length < 2 || body.length > 10000) {
      status('reply-feedback', 'Antes de confirmar, mantenha no campo o texto enviado pelo Gmail (2 a 10.000 caracteres).', true);
      return;
    }
    if (!window.confirm('Você já clicou em ENVIAR no Gmail e confirmou o envio? Isso marcará a carta como respondida no gabinete.')) return;
    const id = currentLetter.id;
    $('mark-letter-replied').disabled = true;
    status('reply-feedback', 'Registrando a confirmação…');
    try {
      const { error } = await client.rpc('mark_letter_replied', {p_letter_id: id, p_reply_text: body});
      if (error) throw error;
      await loadLetters();
      openLetter(id);
      status('reply-feedback', 'Correspondência registrada como respondida. O histórico foi preservado.');
    } catch (err) {
      const unavailable = /mark_letter_replied|schema cache|could not find the function/i.test(String(err?.message || ''));
      status('reply-feedback', unavailable
        ? 'O controle ainda precisa ser ativado no banco Supabase. A carta continua pendente, sem alterações.'
        : 'Não foi possível marcar a carta como respondida: ' + (err?.message || 'erro desconhecido'), true);
    } finally { $('mark-letter-replied').disabled = false; }
  }
  function openLetter(id) {
    currentLetter = letters.find(x => x.id === id);
    if (!currentLetter) return;
    $('letter-heading').textContent = `Carta de ${currentLetter.alias}`;
    $('letter-meta').textContent = `Recebida em ${timestamp(currentLetter.created_at)} · Responder para: ${currentLetter.email}`;
    $('letter-message').textContent = currentLetter.message;
    $('reply-body').value = currentLetter.reply_text || '';
    $('formatted-letter').classList.add('hidden');
    $('formatted-letter-preview').replaceChildren();
    preparedLetterHtml = ''; preparedLetterPlain = '';
    $('reply-template').value = '';
    $('mark-letter-replied').classList.toggle('hidden', currentLetter.status !== 'new');
    $('reply-template').disabled = currentLetter.status !== 'new';
    const answered = currentLetter.status === 'replied';
    $('send-reply').disabled = answered || currentLetter.status === 'sending';
    $('send-reply').textContent = answered ? 'Carta já respondida' : currentLetter.status === 'sending' ? 'Envio em andamento' : 'Preparar resposta no Gmail →';
    $('reply-feedback').textContent = answered ? `Resposta enviada em ${timestamp(currentLetter.replied_at)}.` : '';
    $('letter-detail').classList.remove('hidden'); $('letters-list').classList.add('hidden');
    $('letter-detail').scrollIntoView({behavior:'smooth'});
  }
  async function copyFormattedLetter() {
    if (!preparedLetterHtml) {
      status('reply-feedback', 'Prepare a carta antes de copiá-la.', true);
      return;
    }
    let copied = false;
    try {
      if (navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([preparedLetterHtml], { type: 'text/html' }),
          'text/plain': new Blob([preparedLetterPlain], { type: 'text/plain' })
        })]);
        copied = true;
      }
    } catch (_) { /* tentativa alternativa abaixo */ }
    if (!copied) {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents($('formatted-letter-preview'));
        selection.removeAllRanges();
        selection.addRange(range);
        copied = document.execCommand('copy');
        selection.removeAllRanges();
      } catch (_) { /* mantém a prévia disponível */ }
    }
    if (copied) {
      status('reply-feedback', 'Carta copiada com saudação, despedida e logo. Agora abra o Gmail, remova a assinatura antiga se ela aparecer e cole com Ctrl + V.');
      $('copy-formatted-letter').textContent = '✓ Copiada! Copiar novamente';
    } else {
      status('reply-feedback', 'A cópia automática não foi permitida. Selecione a prévia da carta abaixo, pressione Ctrl + C e depois cole no Gmail com Ctrl + V.', true);
    }
  }

  async function replyLetter(event) {
    event.preventDefault();
    if (!currentLetter) return;
    const body = clean($('reply-body').value);
    if (body.length < 2 || body.length > 10000) {
      status('reply-feedback', 'A resposta deve conter entre 2 e 10.000 caracteres.', true);
      return;
    }
    const recipient = clean(currentLetter.email);
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      status('reply-feedback', 'Esta carta não tem um e-mail válido para resposta.', true);
      return;
    }
    const greeting = 'Caro(a) leitor(a),';
    const introduction = 'Que estas palavras o(a) encontrem em serenidade.\n\nRecebi sua mensagem e a li com a atenção reservada àquilo que não se diz a qualquer um. Há cartas que apenas chegam; outras, porém, permanecem.';
    const formattedBody = body.split(/\n\s*\n/).filter(Boolean).map(paragraph =>
      '<p style="margin:0 0 20px 0;white-space:pre-wrap;color:#332b32;font-family:Georgia,serif;font-size:19px;line-height:1.68;">' +
      escapeHtml(paragraph) + '</p>'
    ).join('');
    const logoUrl = 'https://msaddams.com/assets/ms-addams-logo-email.png';
    const htmlLetter = `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:650px;border-collapse:collapse;background:#fcf9f6;color:#332b32;font-family:Georgia,serif"><tbody><tr><td style="padding:36px 34px 32px 34px;border-top:4px solid #6b4859;border-left:1px solid #dfcdd0;border-right:1px solid #dfcdd0;border-bottom:1px solid #dfcdd0">
    <p style="font:11px Arial,sans-serif;letter-spacing:2px;color:#9a7182;margin:0 0 13px">CORRESPONDÊNCIA PARTICULAR</p>
    <p style="border-top:1px solid #d9c1c6;margin:0 0 28px"></p>
    <p style="margin:0 0 23px;color:#69495b;font:italic 23px Georgia,serif">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 25px;white-space:pre-line;color:#44343c;font-family:Georgia,serif;font-size:19px;line-height:1.7;">${escapeHtml(introduction)}</p>
    ${formattedBody}
    <p style="margin:36px 0 8px;font:italic 21px Georgia,serif;color:#6b4859">Até que nossas palavras se encontrem novamente,</p>
    <p style="margin:0 0 19px;color:#8a6a7b;font:italic 17px Georgia,serif">Há histórias que só se revelam no silêncio.</p>
    <p style="border-top:1px solid #d9c1c6;margin:0 0 18px"></p>
    <img src="${logoUrl}" alt="Ms. Addams — Correspondência particular" width="312" height="73" style="display:block;width:312px;max-width:100%;height:auto;border:0">
    </td></tr></tbody></table>`;
    const previewBox = $('formatted-letter-preview');
    previewBox.innerHTML = htmlLetter;
    $('formatted-letter').classList.remove('hidden');

    preparedLetterHtml = htmlLetter;
    preparedLetterPlain = greeting + '\n\n' + introduction + '\n\n' + body + '\n\nAté que nossas palavras se encontrem novamente,\nMs. Addams\nHá histórias que só se revelam no silêncio.';
    $('copy-formatted-letter').textContent = '1. Copiar carta formatada';
    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('authuser', 'msaddams.escritos@gmail.com');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('fs', '1');
    gmailUrl.searchParams.set('to', recipient);
    gmailUrl.searchParams.set('su', 'Uma resposta às suas entrelinhas | Ms. Addams');
    $('open-gmail-compose').href = gmailUrl.toString();
    status('reply-feedback', 'A carta foi preparada na prévia abaixo, com a nova saudação e despedida. Clique em “Copiar carta formatada”, depois em “Abrir Gmail” e cole no corpo da mensagem com Ctrl + V.');
    $('formatted-letter').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  $('letter-search').addEventListener('input', renderLetters);
  $('letter-filter').addEventListener('change', renderLetters);
  $('reply-template').addEventListener('change', () => {
    const chosen = $('reply-template').value;
    if (!letterTemplates[chosen] || !currentLetter || currentLetter.status !== 'new') return;
    if (clean($('reply-body').value) && !window.confirm('Substituir o texto atual pelo modelo selecionado?')) {
      $('reply-template').value = ''; return;
    }
    $('reply-body').value = letterTemplates[chosen];
    $('reply-body').focus();
  });
  $('mark-letter-replied').addEventListener('click', confirmLetterSent);
  $('copy-formatted-letter').addEventListener('click', copyFormattedLetter);
  $('reply-body').addEventListener('input', () => {
    if (preparedLetterHtml) {
      preparedLetterHtml = ''; preparedLetterPlain = '';
      $('formatted-letter').classList.add('hidden');
      status('reply-feedback', 'A resposta mudou. Prepare a carta novamente para atualizar a prévia.');
    }
  });
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
