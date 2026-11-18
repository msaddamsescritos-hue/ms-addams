/* Ms. Addams — experiência de leitura e cartões autorais.
   Funciona apenas no navegador; não acessa chaves privadas nem modifica manuscritos. */
(() => {
  'use strict';
  if (document.body.dataset.page !== 'chapter') return;
  const root = document.getElementById('chapter-content');
  if (!root) return;
  const make = (tag, cls, value) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (value !== undefined) el.textContent = value;
    return el;
  };
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function enhance() {
    const paper = root.querySelector('.reading-paper');
    if (!paper || paper.dataset.enhanced === 'true') return;
    paper.dataset.enhanced = 'true';
    // Em manuscritos longos, a autora às vezes usa apenas uma quebra de linha.
    // Dividir blocos extensos evita que o modo livro vire uma única página gigante.
    const original = Array.from(paper.children).flatMap(node => {
      if (node.tagName !== 'P' || node.classList.contains('reader-note') ||
          node.classList.contains('chapter-signature')) return [node];
      const raw = (node.textContent || '').trim();
      const blocks = raw.split(/\n+/).map(v=>v.trim()).filter(Boolean);
      if (blocks.length === 1 && raw.split(/\s+/).length <= 290) return [node];
      const normalized = [];
      blocks.forEach(block => {
        const words = block.split(/\s+/);
        for (let i = 0; i < words.length; i += 235) {
          const fragment = make('p',node.className,words.slice(i,i+235).join(' '));
          normalized.push(fragment);
        }
      });
      node.remove();
      return normalized;
    });
    const chunks = [];
    let group = [], words = 0;
    original.forEach(node => {
      const count = (node.textContent || '').trim().split(/\s+/).filter(Boolean).length;
      if (group.length && (words + count > 275 || node.classList.contains('chapter-signature'))) {
        chunks.push(group); group = []; words = 0;
      }
      group.push(node); words += count;
    });
    if (group.length) chunks.push(group);
    if (!chunks.length) return;
    // Evita uma página isolada contendo apenas a assinatura.
    if (chunks.length > 1 && chunks[chunks.length - 1].length === 1 &&
      chunks[chunks.length - 1][0].classList.contains('chapter-signature')) {
      chunks[chunks.length - 2].push(chunks.pop()[0]);
    }
    chunks.forEach((nodes, i) => {
      const section = make('section','reader-leaf');
      section.dataset.pageNumber = String(i + 1);
      section.setAttribute('aria-label','Página ' + (i + 1) + ' de ' + chunks.length);
      nodes.forEach(n => section.append(n));
      paper.append(section);
    });
    let pageIndex = 0;
    let bookMode = false;
    const toolbar = make('div','manuscript-toolbar');
    const modeButton = make('button','manuscript-button','✧ Folhear como livro');
    modeButton.type = 'button';
    modeButton.setAttribute('aria-pressed','false');
    const quoteButton = make('button','manuscript-button','✦ Criar cartão de frase');
    quoteButton.type = 'button';
    const hint = make('span','manuscript-hint','Selecione um trecho do capítulo ou use a frase de abertura.');
    toolbar.append(modeButton,quoteButton,hint);
    paper.parentElement.insertBefore(toolbar,paper);
    const nav = make('nav','manuscript-pager');
    nav.setAttribute('aria-label','Folhear páginas do manuscrito');
    const previous = make('button','manuscript-button','← Anterior');
    const position = make('span','manuscript-count');
    position.setAttribute('aria-live','polite');
    const next = make('button','manuscript-button','Próxima →');
    [previous,next].forEach(b => b.type = 'button');
    nav.append(previous,position,next);
    paper.insertAdjacentElement('afterend',nav);
    function renderPages() {
      paper.classList.toggle('book-mode',bookMode);
      nav.hidden = !bookMode;
      for (const leaf of paper.querySelectorAll('.reader-leaf')) {
        leaf.classList.toggle('reader-leaf-active',Number(leaf.dataset.pageNumber) === pageIndex + 1);
      }
      position.textContent = 'Página ' + (pageIndex + 1) + ' de ' + chunks.length;
      previous.disabled = pageIndex === 0;
      next.disabled = pageIndex === chunks.length - 1;
      modeButton.textContent = bookMode ? '↕ Leitura contínua' : '✧ Folhear como livro';
      modeButton.setAttribute('aria-pressed',String(bookMode));
      const track = document.getElementById('reader-progress');
      if (track) track.hidden = bookMode;
    }
    modeButton.addEventListener('click', () => {
      bookMode = !bookMode; pageIndex = 0; renderPages();
      if (bookMode) paper.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});
    });
    function go(delta) {
      pageIndex = Math.max(0,Math.min(chunks.length - 1,pageIndex + delta));
      renderPages();
      paper.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});
    }
    previous.addEventListener('click',()=>go(-1));
    next.addEventListener('click',()=>go(1));
    renderPages();
    quoteButton.addEventListener('click', async () => {
      const selection = window.getSelection();
      const selected = selection && selection.rangeCount &&
        paper.contains(selection.anchorNode) && paper.contains(selection.focusNode)
          ? selection.toString().replace(/\s+/g,' ').trim() : '';
      const epigraph = (root.querySelector('.reading-header .epigraph')?.textContent || '').trim().replace(/^“|”$/g,'');
      const first = paper.querySelector('.reader-leaf p:not(.reader-note):not(.chapter-signature)');
      const quotation = (selected.length >= 15 ? selected : (epigraph || first?.textContent || '')).trim().slice(0,380);
      if (!quotation) return;
      const title = (root.querySelector('.reading-header h1')?.textContent || 'Um manuscrito').trim();
      try { await showCard(quotation,title); }
      catch (err) { window.alert('Não foi possível gerar a imagem neste navegador. Tente novamente.'); }
    });
  }
  function wrap(ctx,text,maxWidth) {
    const lines = []; let line = '';
    for (const word of text.split(/\s+/)) {
      const candidate = line ? line + ' ' + word : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
  }
  async function showCard(quotation,title) {
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1350;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('Canvas indisponível');
    const gradient = g.createLinearGradient(0,0,0,1350);
    gradient.addColorStop(0,'#2f202e'); gradient.addColorStop(1,'#171118');
    g.fillStyle = gradient; g.fillRect(0,0,1080,1350);
    g.strokeStyle = '#ac827d'; g.lineWidth = 2;
    g.strokeRect(65,64,950,1222);g.strokeRect(78,78,924,1196);
    g.textAlign = 'center'; g.fillStyle = '#d3aa9d';
    g.font = '26px Georgia,serif'; g.fillText('✧',540,125);
    g.fillStyle = '#dcc5b7';g.font = '24px Georgia,serif';
    g.fillText('UM MANUSCRITO DE MS. ADDAMS',540,198);
    g.strokeStyle='#855b65';g.beginPath();g.moveTo(250,234);g.lineTo(830,234);g.stroke();
    let fontSize = 62; let lines = [];
    do {
      g.font = 'italic ' + fontSize + 'px Georgia,serif';
      lines = wrap(g,'“' + quotation.replace(/^“|”$/g,'') + '”',780);
      if (lines.length * fontSize * 1.5 < 720) break;
      fontSize -= 3;
    } while (fontSize > 34);
    g.fillStyle = '#f1e4d8';
    const lineHeight = fontSize * 1.48;
    const start = Math.max(335,690 - (lines.length - 1) * lineHeight / 2);
    lines.forEach((line,i)=>g.fillText(line,540,start+i*lineHeight));
    g.fillStyle = '#c9a7a7';g.font = '26px Georgia,serif';
    const heading = title.length > 54 ? title.slice(0,51)+'…' : title;
    g.fillText(heading,540,1114);
    g.fillStyle = '#e5c3b2';g.font = '38px Georgia,serif';
    g.fillText('— Ms. Addams',540,1192);
    g.font = '23px Georgia,serif';g.fillText('msaddams.com',540,1240);
    const blob = await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível criar PNG')),'image/png'));
    const url = URL.createObjectURL(blob);
    let dialog = document.getElementById('msaddams-card-dialog');
    if (dialog) dialog.remove();
    dialog = make('dialog','msaddams-card-dialog');dialog.id = 'msaddams-card-dialog';
    const headingNode = make('h2','','Sua frase, em forma de carta');
    const preview = document.createElement('img');preview.src=url;preview.alt='Cartão com frase do capítulo, assinatura de Ms. Addams e endereço do site';
    const actions = make('div','msaddams-card-actions');
    const download = document.createElement('a');download.className='manuscript-button';download.href=url;download.download='ms-addams-frase.png';download.textContent='↓ Baixar imagem';
    const close = make('button','manuscript-button','Fechar');close.type='button';
    actions.append(download);
    if (navigator.canShare && typeof File !== 'undefined' && navigator.canShare({files:[new File([blob],'ms-addams-frase.png',{type:'image/png'})]})) {
      const share = make('button','manuscript-button','Compartilhar');share.type='button';
      share.addEventListener('click',async()=>{
        try {await navigator.share({files:[new File([blob],'ms-addams-frase.png',{type:'image/png'})],title:'Ms. Addams'});}
        catch(e){ if(e.name!=='AbortError') window.alert('Compartilhamento indisponível. Baixe a imagem.');}
      });
      actions.append(share);
    }
    actions.append(close);dialog.append(headingNode,preview,actions);document.body.append(dialog);
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{URL.revokeObjectURL(url);dialog.remove();},{once:true});
    if(typeof dialog.showModal==='function') dialog.showModal();
    else {dialog.setAttribute('open','');close.addEventListener('click',()=>{URL.revokeObjectURL(url);dialog.remove()},{once:true});}
  }
  const observer = new MutationObserver(enhance);
  observer.observe(root,{childList:true,subtree:true});
  enhance();
})();
