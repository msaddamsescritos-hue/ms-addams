
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
  let letterOrganizationEnabled = false;
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
    const clubOptions = $('club-chapter-select');
    if (clubOptions) {
      const selected = clubOptions.value;
      clubOptions.replaceChildren(new Option('Selecione um manuscrito',''));
      chapters.filter(c => c.published).forEach(c => {
        clubOptions.add(new Option('Capítulo '+ c.number +' — '+ c.title,c.slug));
      });
      if (chapters.some(c => c.published && c.slug === selected)) clubOptions.value = selected;
    }
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
      if (c.published) {
        const promo = document.createElement('button'); promo.className = 'outline-btn';
        promo.type = 'button'; promo.textContent = 'Copiar divulgação ↗';
        promo.title = 'Copia uma chamada curta, sem spoilers, com o link do capítulo';
        promo.addEventListener('click', async () => {
          const quote = clean(c.epigraph || c.body).split(/[.!?]+/).find(x => x.trim().length > 25)?.trim()
             || clean(c.epigraph || c.body).slice(0, 160);
          const excerptText = quote.slice(0, 180).trim() + (quote.length > 180 ? '…' : '');
          const shareText = `“${excerptText}”\n\nCapítulo ${String(c.number).padStart(2,'0')} — ${c.title}\nLeia no blog da Ms. Addams 🖤\nhttps://msaddams.com/capitulo.html?slug=${encodeURIComponent(c.slug)}`;
          try {
            await navigator.clipboard.writeText(shareText);
            promo.textContent = 'Divulgação copiada ✓';
          } catch (_) {
            window.prompt('Copie a divulgação para o Instagram:',shareText);
          }
        });
        actions.append(promo);
      }
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
    updateManuscriptCounters();
    $('editor-block').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function updateManuscriptCounters() {
    const body = $('chapter-body').value.trim();
    const words = body ? body.split(/\s+/).length : 0;
    $('manuscript-word-count').textContent = `${new Intl.NumberFormat('pt-BR').format(words)} palavras · cerca de ${Math.max(1, Math.ceil(words / 220))} min de leitura`;
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
    for (const t of ['manuscripts','letters','club']) {
      const selected = which === t;
      $(`tab-${t}`).classList.toggle('active', selected);
      $(`tab-${t}`).setAttribute('aria-selected', String(selected));
      $(`section-${t}`).classList.toggle('hidden', !selected);
    }
  }
  async function clubNotification(mode) {
    const slug=$('club-chapter-select').value;
    const sendButton=$('club-notify-send');
    const previewButton=$('club-notify-preview');
    if (!cfg.clubEnabled) {
      status('club-notify-feedback','O envio de avisos será liberado após configurar o Supabase e o remetente do clube.',true);
      return;
    }
    if (!slug) {status('club-notify-feedback','Selecione um capítulo publicado.',true);return;}
    if (mode==='send' && !window.confirm('Enviar avisos para ATÉ DEZ leitores com inscrição confirmada? Não serão repetidos os avisos já registrados.')) return;
    sendButton.disabled=true;previewButton.disabled=true;
    status('club-notify-feedback',mode==='preview' ? 'Consultando inscrições…' : 'Enviando avisos…');
    try {
      const {data:{session}}=await client.auth.getSession();
      if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente.');
      const response=await fetch(functionUrl('club-notify'), {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
        body:JSON.stringify({mode,slug})
      });
      const result=await response.json().catch(()=>({}));
      if (!response.ok)throw new Error(result.error || 'Não foi possível processar os avisos.');
      if (mode==='preview') {
        status('club-notify-feedback','Confirmados: '+(result.confirmed || 0)+'. Já avisados sobre este capítulo: '+(result.sent || 0)+'. Nenhum e-mail foi enviado nesta consulta.');
      } else {
        const text='Enviados agora: '+(result.sent || 0)+'. Falhas: '+(result.failed || 0)+'. Cancelados ignorados: '+(result.skipped || 0)+'.';
        status('club-notify-feedback',text+(result.moreMayRemain ? ' Pode haver outros leitores; envie outro lote se desejar.' : ' Não há indicação de outro lote pendente.'));
      }
    } catch(err) {status('club-notify-feedback',err.message || 'Não foi possível enviar os avisos.',true);}
    finally {sendButton.disabled=false;previewButton.disabled=false;}
  }
  async function loadClub() {
    const feedback = $('club-admin-feedback');
    const list = $('club-admin-list');
    if (!feedback || !list || !client) return;
    feedback.textContent = 'Consultando os leitores…';
    list.replaceChildren();
    try {
      const [members, confirmed, pending, unsubscribed] = await Promise.all([
        client.from('club_subscribers')
          .select('email,pseudonym,status,created_at,confirmed_at,unsubscribed_at')
          .order('created_at',{ascending:false}).limit(100),
        client.from('club_subscribers').select('id',{head:true,count:'exact'}).eq('status','confirmed'),
        client.from('club_subscribers').select('id',{head:true,count:'exact'}).eq('status','pending'),
        client.from('club_subscribers').select('id',{head:true,count:'exact'}).eq('status','unsubscribed')
      ]);
      const error = [members,confirmed,pending,unsubscribed].find(result => result.error)?.error;
      if (error) throw error;
      $('club-confirmed').textContent=String(confirmed.count || 0);
      $('club-pending').textContent=String(pending.count || 0);
      $('club-unsubscribed').textContent=String(unsubscribed.count || 0);
      const data = members.data || [];
      if (!data.length) {
        const empty=document.createElement('p');empty.className='empty-state';
        empty.textContent='Ainda não há inscritos. O clube só registra quem solicita a entrada e confirma o próprio e-mail.';
        list.append(empty);
      }
      for (const member of data) {
        const row=document.createElement('div');row.className='club-admin-row';
        const who=document.createElement('div');
        const name=document.createElement('strong');
        name.textContent=member.pseudonym || 'Leitor(a) sem pseudônimo';
        const email=document.createElement('small');email.textContent=member.email;
        who.append(name,email);
        const flag=document.createElement('em');
        flag.textContent=member.status==='confirmed' ? 'Confirmado' :
          member.status==='pending' ? 'Aguardando confirmação' : 'Cancelado';
        row.append(who,flag);list.append(row);
      }
      feedback.textContent = 'Dados privados, disponíveis somente para a autora. Mostrando até 100 inscrições recentes.';
    } catch (err) {
      feedback.className='form-feedback error';
      feedback.textContent='O Clube de Leitores ainda precisa da tabela db/clube-leitores.sql no Supabase, ou houve um problema de conexão: '+(err?.message || 'erro desconhecido');
    }
  }

  // Filtros e busca são locais: nenhuma carta é alterada ao pesquisar.
  function renderLetters() {
    const list = $('letters-list'); list.replaceChildren();
    const filter = $('letter-filter').value;
    const search = clean($('letter-search').value).toLocaleLowerCase('pt-BR');
    const filtered = letters.filter(l => {
      const archived = Boolean(l.archived_at);
      const matchesStatus = filter === 'archived' ? archived :
        !archived && (filter === 'all' || (filter === 'replied' ? l.status === 'replied' :
          filter === 'unread' ? letterOrganizationEnabled && !l.read_at :
          l.status !== 'replied'));
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
      metadata.textContent = `${timestamp(l.created_at)} · ${l.archived_at ? 'Arquivada' :
        l.status === 'replied' ? 'Respondida' : l.status === 'sending' ? 'Envio em andamento' :
        (letterOrganizationEnabled && !l.read_at ? '✧ Não lida' : 'Pendente')}`;
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
    const { data, error } = await client.from('letters').select('*').order('created_at', {ascending:false}).limit(200);
    if (error) { $('letters-list').textContent = `Erro ao ler cartas: ${error.message}`; return; }
    letters = data || [];
    letterOrganizationEnabled = Boolean(letters.length && Object.hasOwn(letters[0], 'read_at') &&
      Object.hasOwn(letters[0], 'archived_at') && Object.hasOwn(letters[0], 'draft_reply'));
    $('letter-organization-feedback').textContent = letterOrganizationEnabled || !letters.length ? '' :
      'Para usar Não lidas, Arquivar e Salvar rascunho, execute db/organizar-correspondencias.sql no SQL Editor do Supabase. As cartas existentes permanecem preservadas.';
    $('letter-filter').querySelectorAll('option[value="unread"],option[value="archived"]').forEach(option => {
      option.disabled = !letterOrganizationEnabled;
    });
    if (!letterOrganizationEnabled && ['archived','unread'].includes($('letter-filter').value)) {
      $('letter-filter').value = 'pending';
    }
    $('count-letters').textContent = letters.filter(x => x.status !== 'replied' && !x.archived_at).length;
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
  async function manageCurrentLetter(action) {
    if (!letterOrganizationEnabled || !currentLetter) return;
    const id = currentLetter.id;
    const content = action === 'save_draft' ? $('reply-body').value : null;
    if (action === 'save_draft' && content.length > 10000) {
      status('reply-feedback', 'O rascunho excede o limite de caracteres.', true); return;
    }
    if (action === 'archive' && !window.confirm('Arquivar esta carta? Ela continuará guardada e poderá ser restaurada depois.')) return;
    $('archive-letter').disabled = true;
    $('save-letter-draft').disabled = true;
    try {
      const {error} = await client.rpc('manage_letter', {p_letter_id:id, p_action:action, p_text:content});
      if (error) throw error;
      await loadLetters();
      if (action === 'save_draft') {
        openLetter(id);
        status('reply-feedback', 'Rascunho privado salvo com segurança no banco de dados.');
      } else {
        $('letter-detail').classList.add('hidden');
        $('letters-list').classList.remove('hidden');
        currentLetter = null;
        $('letter-organization-feedback').textContent = action === 'archive'
          ? 'Carta arquivada, sem exclusão. Use o filtro Arquivadas para restaurá-la.'
          : 'Carta restaurada à lista de correspondências.';
      }
    } catch(err) {
      status('reply-feedback', err.message || 'Não foi possível atualizar esta carta.', true);
    } finally {
      $('archive-letter').disabled = false;
      $('save-letter-draft').disabled = false;
    }
  }
  function openLetter(id) {
    currentLetter = letters.find(x => x.id === id);
    if (!currentLetter) return;
    $('letter-heading').textContent = `Carta de ${currentLetter.alias}`;
    $('letter-meta').textContent = `Recebida em ${timestamp(currentLetter.created_at)} · Responder para: ${currentLetter.email}`;
    $('letter-message').textContent = currentLetter.message;
    $('reply-body').value = (letterOrganizationEnabled && currentLetter.status === 'new' ? currentLetter.draft_reply : null) || currentLetter.reply_text || '';
    $('reply-template').value = '';
    $('mark-letter-replied').classList.toggle('hidden', currentLetter.status !== 'new');
    $('reply-template').disabled = currentLetter.status !== 'new';
    $('archive-letter').classList.toggle('hidden', !letterOrganizationEnabled);
    $('archive-letter').textContent = currentLetter.archived_at ? 'Restaurar carta do arquivo' : 'Arquivar carta';
    $('save-letter-draft').classList.toggle('hidden', !letterOrganizationEnabled || currentLetter.status !== 'new');
    if (letterOrganizationEnabled && !currentLetter.read_at) {
      const letterId = currentLetter.id;
      client.rpc('manage_letter', {p_letter_id: letterId, p_action: 'mark_read'}).then(({error}) => {
        if (!error) {
          const updated = letters.find(letter => letter.id === letterId);
          if (updated) updated.read_at = new Date().toISOString();
          renderLetters();
        }
      }).catch(()=>{});
    }
    const answered = currentLetter.status === 'replied';
    $('send-reply').disabled = answered || currentLetter.status === 'sending';
    $('send-reply').textContent = answered ? 'Carta já respondida' : currentLetter.status === 'sending' ? 'Envio em andamento' : 'Abrir minha carta pronta no Gmail →';
    $('reply-feedback').textContent = answered ? `Resposta enviada em ${timestamp(currentLetter.replied_at)}.` : '';
    $('letter-detail').classList.remove('hidden'); $('letters-list').classList.add('hidden');
    $('letter-detail').scrollIntoView({behavior:'smooth'});
  }
  // Um clique prepara o texto completo no próprio Gmail.
  // Links de composição do Gmail não aceitam HTML nem estilos na mensagem.
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
    const emailBody = [
      'Caro(a) leitor(a),',
      '',
      'Que estas palavras o(a) encontrem em serenidade.',
      '',
      'Recebi sua mensagem e a li com a atenção reservada àquilo que não se diz a qualquer um. Há cartas que apenas chegam; outras, porém, permanecem.',
      '',
      body,
      '',
      'Até que nossas palavras se encontrem novamente,',
      'Ms. Addams'
    ].join('\n');
    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('authuser', 'msaddams.escritos@gmail.com');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('fs', '1');
    gmailUrl.searchParams.set('to', recipient);
    gmailUrl.searchParams.set('su', 'Uma resposta às suas entrelinhas | Ms. Addams');
    gmailUrl.searchParams.set('body', emailBody);

    const feedback = $('reply-feedback');
    feedback.replaceChildren();
    feedback.className = 'form-feedback success';
    feedback.append(document.createTextNode('A carta foi preparada no Gmail com saudação, resposta e despedida. Confira o remetente antes de enviar. Se o Gmail não abrir automaticamente: '));
    const link = document.createElement('a');
    link.href = gmailUrl.toString();
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.referrerPolicy = 'no-referrer';
    link.textContent = 'Abrir carta no Gmail ↗';
    feedback.append(link);
    // Acionado pela interação da própria autora; mantém link clicável caso haja bloqueio.
    link.click();
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
  $('chapter-body').addEventListener('input', updateManuscriptCounters);
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
  $('archive-letter').addEventListener('click', () => manageCurrentLetter(currentLetter?.archived_at ? 'restore' : 'archive'));
  $('save-letter-draft').addEventListener('click', () => manageCurrentLetter('save_draft'));
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
  $('club-notify-preview').addEventListener('click',()=>clubNotification('preview'));
  $('club-notify-send').addEventListener('click',()=>clubNotification('send'));
  $('refresh-club').addEventListener('click',loadClub);
  document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click',()=>{
    switchTab(tab.dataset.tab);
    if (tab.dataset.tab === 'club') loadClub();
  }));
  if (client) client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') showLogin(); });
  guard();
})();
