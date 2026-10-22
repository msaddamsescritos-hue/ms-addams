(() => {
  'use strict';
  const cfg = window.ADDAMS_CONFIG || {};
  const functionUrl = name => `${String(cfg.supabaseUrl || '').replace(/\/$/, '')}/functions/v1/${name}`;
  const configured = Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey);
  const supa = configured && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey) : null;
  const $ = selector => document.querySelector(selector);
  const openingChapter = {
    number: 1,
    slug: 'capitulo-1-desventura-em-serie',
    title: 'Desventura em série',
    epigraph: 'Ultimamente, a vida tem se dedicado a me apresentar uma sucessão de desventuras. O curioso é que, em quase todas elas, o que mais me surpreende não é o acontecimento em si, mas a pessoa de quem ele veio.',
    body: 'É curioso como a decepção chega sem anunciar sua chegada. Elas simplesmente acontecem, muitas vezes disfarçadas de pequenos gestos, palavras mal colocadas ou silêncios que dizem mais do que gostaríamos de ouvir.\n\nUltimamente tenho me perguntado se o problema está nas pessoas que atravessam a minha vida ou na maneira como eu insisto em enxergá-las?\n\n[Prévia do Capítulo I. Substitua pelo manuscrito completo antes de publicar.]',
    sample: true
  };
  const empty = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };
  const elem = (tag, className, content) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (content !== undefined) n.textContent = content;
    return n;
  };
  const excerpt = (value, limit = 148) => { const s = String(value || '').replace(/\s+/g, ' ').trim(); return s.length > limit ? s.slice(0, limit - 1).trimEnd() + '…' : s; };
  function showStatus(node, message, isError = false) {
    node.textContent = message;
    node.className = isError ? 'form-feedback error' : 'form-feedback success';
  }
  function makeChapterCard(chapter) {
    const item = elem('article', 'chapter-card');
    item.append(elem('div', 'chapter-count', String(chapter.number).padStart(2, '0')));
    item.append(elem('div', 'chapter-eyebrow', chapter.sample ? 'TRECHO DE APRESENTAÇÃO' : `MANUSCRITO Nº ${chapter.number}`));
    item.append(elem('h3', '', chapter.title));
    item.append(elem('p', '', excerpt(chapter.epigraph || chapter.body)));
    item.append(elem('p', 'reading-time', `${Math.max(1, Math.ceil(String(chapter.body || '').trim().split(/\s+/).filter(Boolean).length / 220))} min de leitura`));
    const link = elem('a', '', 'Ler manuscrito  ↗');
    link.href = `capitulo.html?slug=${encodeURIComponent(chapter.slug)}`;
    item.append(link);
    return item;
  }
  async function loadLibrary() {
    const root = $('#chapters'); if (!root) return;
    let chapters = [];
    if (!supa && !configured) chapters = [openingChapter];
    else if (!supa) { root.replaceChildren(elem('div', 'notice', 'A biblioteca está temporariamente indisponível.')); return; }
    else {
      const { data, error } = await supa.from('chapters').select('number,slug,title,epigraph,body,published_at').eq('published', true).order('number', { ascending: true });
      if (error) { root.replaceChildren(elem('div', 'notice', 'Não foi possível abrir a biblioteca. Tente novamente mais tarde.')); return; }
      chapters = data || [];
    }
    empty(root);
    if (!chapters.length) {
      root.append(elem('div', 'notice', 'A biblioteca está aguardando seu primeiro capítulo. Volte para descobrir o próximo manuscrito.'));
      return;
    }
    chapters.forEach(c => root.append(makeChapterCard(c)));
  }
  async function loadChapter() {
    const root = $('#chapter-content'); if (!root) return;
    const slug = new URLSearchParams(location.search).get('slug');
    if (!slug || slug.length > 140) { root.replaceChildren(elem('p', 'notice', 'O manuscrito não foi encontrado.')); return; }
    let chapter = null;
    if (!supa && !configured) chapter = slug === openingChapter.slug ? openingChapter : null;
    else if (!supa) { root.replaceChildren(elem('p', 'notice', 'Não foi possível abrir o manuscrito.')); return; }
    else {
      const { data, error } = await supa.from('chapters').select('number,title,epigraph,body,published_at').eq('slug', slug).eq('published', true).maybeSingle();
      if (!error) chapter = data;
    }
    if (!chapter) { root.replaceChildren(elem('p', 'notice', 'Este manuscrito não está disponível para leitura.')); return; }
    document.title = `${chapter.title} · Ms. Addams`;
    empty(root);
    const header = elem('div', 'reading-header');
    header.append(elem('span', 'kicker', `${chapter.sample ? 'PRÉVIA · ' : ''}CAPÍTULO ${String(chapter.number).padStart(2, '0')}`));
    header.append(elem('h1', '', chapter.title));
    if (chapter.epigraph) header.append(elem('p', 'epigraph', `“${chapter.epigraph}”`));
    const words = String(chapter.body || '').trim().split(/\s+/).filter(Boolean).length;
    header.append(elem('p', 'reading-time', `Leitura de aproximadamente ${Math.max(1, Math.ceil(words / 220))} min · Capítulo ${String(chapter.number).padStart(2, '0')}`));
    root.append(header);
    const paper = elem('div', 'reading-paper');
    if (chapter.sample) paper.append(elem('p', 'reader-note', 'Trecho de apresentação. A versão integral ainda será adicionada pela autora.'));
    const paragraphs = String(chapter.body || '').trim().split(/\n\s*\n/);
    paragraphs.forEach(p => { if (p.trim()) paper.append(elem('p', '', p.trim())); });
    paper.append(elem('p', 'chapter-signature', '— Ms. Addams'));
    root.append(paper);
    // Navegação somente entre capítulos PUBLICADOS; nunca revela rascunhos.
    let library = [];
    if (!supa && !configured) library = [openingChapter];
    else if (supa) {
      const {data, error} = await supa.from('chapters')
        .select('number,slug,title').eq('published', true).order('number', {ascending:true});
      if (!error) library = data || [];
    }
    const at = library.findIndex(c => c.number === chapter.number);
    if (at >= 0 && library.length > 1) {
      const nav = elem('nav','chapter-navigation');
      nav.setAttribute('aria-label','Navegar entre manuscritos publicados');
      const createNav = (target, label) => {
        const a = elem('a','chapter-nav-link', label + ' · ' + target.title);
        a.href = 'capitulo.html?slug=' + encodeURIComponent(target.slug);
        return a;
      };
      if (at > 0) nav.append(createNav(library[at - 1], '← Anterior'));
      if (at < library.length - 1) nav.append(createNav(library[at + 1], 'Próximo →'));
      root.append(nav);
    }
    const share = elem('div','chapter-share-tools');
    const shareLabel = elem('span','kicker','ESTE MANUSCRITO TOCOU VOCÊ?');
    const shareButton = elem('button','outline-btn','Compartilhar capítulo ↗');
    shareButton.type = 'button';
    shareButton.addEventListener('click',async () => {
      const url = window.location.origin + '/capitulo.html?slug=' + encodeURIComponent(slug);
      if (navigator.share) {
        try { await navigator.share({title:document.title,url}); return; } catch (_) { /* cancelamento */ }
      }
      try { await navigator.clipboard.writeText(url); shareButton.textContent = 'Link copiado ✓'; }
      catch (_) { shareButton.textContent = 'Copie o endereço do navegador para compartilhar'; }
    });
    share.append(shareLabel,shareButton); root.append(share);
  }
  function initLetters() {
    const form = $('#letter-form'); if (!form) return;
    const status = $('#letter-feedback'); const submit = $('#letter-submit');
    let captchaWidget = null;
    if (cfg.turnstileSiteKey) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true; script.defer = true;
      script.onload = () => { if (window.turnstile) captchaWidget = window.turnstile.render('#turnstile-field', { sitekey: cfg.turnstileSiteKey }); };
      document.head.append(script);
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submit.disabled = true;
      showStatus(status, 'Selando sua carta…');
      if (!configured) { showStatus(status, 'O envio de cartas ainda não foi ativado. Volte em breve.', true); submit.disabled = false; return; }
      const payload = {
        alias: form.alias.value.trim(),
        email: form.email.value.trim(),
        message: form.message.value.trim(),
        website: form.website.value,
        consent: Boolean($('#privacy-ok')?.checked),
        turnstileToken: captchaWidget !== null && window.turnstile ? window.turnstile.getResponse(captchaWidget) : ''
      };
      try {
        const res = await fetch(functionUrl('contact'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || 'Não foi possível entregar esta carta.');
        showStatus(status, 'Sua carta foi recebida com discrição. Obrigada por escrever. ✧');
        form.reset();
      } catch (err) { showStatus(status, err.message || 'Erro no envio. Tente novamente.', true); }
      finally { submit.disabled = false; if (captchaWidget !== null && window.turnstile) window.turnstile.reset(captchaWidget); }
    });
  }
  document.querySelectorAll('.copyright-year').forEach(node => node.textContent = String(Math.max(2026, new Date().getFullYear())));
  if (document.body.dataset.page === 'home') { loadLibrary(); initLetters(); }
  if (document.body.dataset.page === 'chapter') loadChapter();
})();
