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

    // Folhear é o modo permanente. Ajusta o número de palavras à largura da tela.
    const pageWordLimit = window.innerWidth < 540 ? 85 : window.innerWidth < 850 ? 135 : 190;
    const original = Array.from(paper.children).flatMap(node => {
      if (node.tagName !== 'P' || node.classList.contains('reader-note') ||
          node.classList.contains('chapter-signature')) return [node];
      const raw = (node.textContent || '').trim();
      const blocks = raw.split(/\n+/).map(v => v.trim()).filter(Boolean);
      if (blocks.length === 1 && raw.split(/\s+/).length <= pageWordLimit) return [node];
      const normalized = [];
      for (const block of blocks) {
        const words = block.split(/\s+/);
        for (let i = 0; i < words.length; i += pageWordLimit) {
          normalized.push(make('p', node.className, words.slice(i,i + pageWordLimit).join(' ')));
        }
      }
      node.remove();
      return normalized;
    });
    const groups = [];
    let group = [], words = 0;
    for (const node of original) {
      if (node.classList.contains('chapter-signature')) {
        if (group.length) group.push(node);
        else if (groups.length) groups[groups.length - 1].push(node);
        else group.push(node);
        continue;
      }
      const count = (node.textContent || '').trim().split(/\s+/).filter(Boolean).length;
      if (group.length && words + count > pageWordLimit) {
        groups.push(group); group = []; words = 0;
      }
      group.push(node);
      words += count;
    }
    if (group.length) groups.push(group);
    if (!groups.length) return;

    const leaves = groups.map((nodes,i) => {
      const leaf = make('section','reader-leaf');
      leaf.dataset.pageNumber = String(i + 1);
      leaf.setAttribute('aria-label','Página '+(i+1)+' de '+groups.length);
      nodes.forEach(node => leaf.append(node));
      paper.append(leaf);
      return leaf;
    });


    // Capa ilustrada como primeira página do livro, sem deslocar os textos originais.
    const cover = make('section','reader-leaf cover-page');
    const coverNumber = root.querySelector('.reading-header .kicker')?.textContent || 'UM MANUSCRITO';
    const coverTitle = root.querySelector('.reading-header h1')?.textContent || 'Ms. Addams';
    cover.append(make('span','cover-number',coverNumber));
    cover.append(make('span','cover-ornament','✧'));
    cover.append(make('h2','cover-title',coverTitle));
    cover.append(make('p','cover-subtitle','O arquivo das desventuras'));
    cover.append(make('span','cover-signature','— Ms. Addams'));
    cover.dataset.pageNumber = '1';
    paper.insertBefore(cover,leaves[0]);
    leaves.unshift(cover);
    // Uma folha final revela a mensagem de encerramento e as reações discretas.
    const ending = make('section','reader-leaf reader-ending-page');
    ending.dataset.ending = 'true';
    ending.append(make('div','reader-ending-flower','✧'));
    ending.append(make('h2','reader-ending-title','O que permanece nas entrelinhas?'));
    ending.append(make('p','reader-ending-text','Algumas histórias terminam aqui. Outras continuam dentro de quem as leu.'));
    ending.append(make('p','reader-ending-signature','— Ms. Addams'));
    const engagementArea = make('div','reader-ending-engagement');
    engagementArea.id = 'reader-ending-engagement';
    ending.append(engagementArea);
    paper.append(ending);
    leaves.push(ending);
    leaves.forEach((leaf,i)=>{
      leaf.dataset.pageNumber=String(i+1);
      leaf.setAttribute('aria-label',i===0?'Capa do manuscrito':'Página '+(i+1)+' de '+leaves.length);
    });
    // Há apenas um modo: livro com virada de página.
    paper.classList.add('book-mode','real-page-turn');
    paper.setAttribute('aria-label','Livro de Ms. Addams. Use as setas ou deslize para virar as páginas.');
    const toolbar = make('div','manuscript-toolbar');
    const quoteButton = make('button','manuscript-button','✦ Criar cartão de frase');
    quoteButton.type = 'button';
    const hint = make('span','manuscript-hint',
      'Folheie com as setas ou deslize para os lados no celular.');
    const bookmark = make('button','manuscript-button bookmark-ribbon','♧ Marcar página');
    bookmark.type = 'button';
    toolbar.append(quoteButton,bookmark,hint);
    paper.parentElement.insertBefore(toolbar,paper);

    const nav = make('nav','manuscript-pager');
    nav.setAttribute('aria-label','Navegar pelas páginas do livro');
    const previous = make('button','manuscript-button manuscript-prev','← Página anterior');
    const position = make('span','manuscript-count');
    position.setAttribute('aria-live','polite');
    const next = make('button','manuscript-button manuscript-next','Próxima página →');
    for (const button of [previous,next]) button.type = 'button';
    nav.append(previous,position,next);
    paper.insertAdjacentElement('afterend',nav);

    // As pontas da folha são atalhos visuais, como em um livro.
    const backEdge = make('button','reader-edge reader-edge-back','‹');
    const nextEdge = make('button','reader-edge reader-edge-next','›');
    backEdge.type = nextEdge.type = 'button';
    backEdge.setAttribute('aria-label','Virar para a página anterior');
    nextEdge.setAttribute('aria-label','Virar para a próxima página');
    paper.append(backEdge,nextEdge);

    const progress = document.getElementById('reader-progress');
    if (progress) progress.hidden = true;

    const slug = new URLSearchParams(window.location.search).get('slug') || 'manuscrito';
    const pageKey = 'msaddams_bookmark_v3:' + slug;
    let current = 0;
    try {
      const saved = Number(window.localStorage.getItem(pageKey));
      if (Number.isInteger(saved) && saved > 0 && saved < leaves.length) current = saved;
    } catch (_) {}
    const savePage = () => {
      try { window.localStorage.setItem(pageKey, String(current)); } catch (_) {}
    };
    let turning = false;
    function render() {
      leaves.forEach((leaf,i) => {
        const active = i === current;
        leaf.classList.toggle('reader-leaf-active',active);
        leaf.setAttribute('aria-hidden',String(!active));
      });
      position.textContent = current === 0 ? 'Capa · ' + leaves.length + ' páginas' : 'Página '+(current+1)+' de '+leaves.length;
      bookmark.textContent = current === 0 ? '♧ Guardar capa' : '♧ Marcar página '+(current+1);
      previous.disabled = backEdge.disabled = turning || current === 0;
      next.disabled = nextEdge.disabled = turning || current === leaves.length-1;
      const finished = current === leaves.length-1;
      const progress = finished ? 100 : current===0 ? 0 :
        Math.min(99,Math.round(100*current/Math.max(1,leaves.length-2)));
      const detail = {slug,index:current,total:leaves.length,percent:progress,
        completed:finished,chapterNumber:Math.max(0,current)};
      window.ADDAMS_READER_STATE = detail;
      document.dispatchEvent(new CustomEvent('msaddams:reader-page',{detail}));
    }
    function turn(delta) {
      const to = current + delta;
      if (turning || to < 0 || to >= leaves.length) return;
      const oldIndex = current;
      if (reduced()) {
        current = to; render(); savePage();
        paper.scrollIntoView({block:'start',behavior:'auto'});
        return;
      }
      turning = true;
      const oldHeight = paper.offsetHeight;
      const pageToTurn = delta > 0 ? leaves[oldIndex] : leaves[to];
      if (delta > 0) current = to; // a próxima página surge sob a folha que se move
      render();
      const height = Math.max(oldHeight,paper.offsetHeight);
      const oldMinHeight = paper.style.minHeight;
      paper.style.minHeight = height + 'px';

      const sheet = make('div','reader-turn-sheet');
      sheet.setAttribute('aria-hidden','true');
      const front = make('div','reader-turn-face reader-turn-front');
      const back = make('div','reader-turn-face reader-turn-back');
      const clone = pageToTurn.cloneNode(true);
      clone.classList.add('reader-leaf-active');
      clone.setAttribute('aria-hidden','true');
      front.append(clone);
      const ornament = make('div','reader-turn-ornament','✧');
      const wordmark = make('p','reader-turn-wordmark','Ms. Addams');
      const line = make('span','reader-turn-line','Um manuscrito entre as linhas');
      back.append(ornament,wordmark,line);
      const appearance = window.getComputedStyle(paper);
      for (const face of [front,back]) {
        face.style.backgroundColor = appearance.backgroundColor;
        face.style.backgroundImage = appearance.backgroundImage;
        face.style.backgroundSize = appearance.backgroundSize;
        face.style.backgroundPosition = appearance.backgroundPosition;
        face.style.backgroundRepeat = appearance.backgroundRepeat;
        face.style.padding = appearance.padding;
      }
      sheet.append(front,back);
      paper.append(sheet);
      sheet.style.transform = delta > 0 ? 'rotateY(0deg)' : 'rotateY(-180deg)';
      // Evita a animação automática de opacity: a página gira 180° no eixo vertical.
      sheet.getBoundingClientRect();
      let finished = false;
      let fallback;
      const complete = () => {
        if (finished) return;
        finished = true;
        if (fallback) window.clearTimeout(fallback);
        if (delta < 0) current = to;
        sheet.remove();
        paper.style.minHeight = oldMinHeight;
        turning = false;
        render();savePage();
      };
      sheet.addEventListener('transitionend',event => {
        if (event.target === sheet && event.propertyName === 'transform') complete();
      });
      window.requestAnimationFrame(() => {
        sheet.classList.add('reader-turn-sheet-active');
        sheet.style.transform = delta > 0 ? 'rotateY(-180deg)' : 'rotateY(0deg)';
      });
      fallback = window.setTimeout(complete,1150);
      paper.scrollIntoView({block:'start',behavior:'auto'});
    }
    bookmark.addEventListener('click',()=>{
      savePage();
      bookmark.textContent='✓ Página '+(current+1)+' guardada';
      window.setTimeout(()=>{bookmark.textContent='♧ Marcar página '+(current+1)},1750);
    });
    previous.addEventListener('click',()=>turn(-1));
    next.addEventListener('click',()=>turn(1));
    backEdge.addEventListener('click',()=>turn(-1));
    nextEdge.addEventListener('click',()=>turn(1));

    // Gestos horizontais — gestos verticais continuam rolando a página naturalmente.
    let touchStart = null;
    paper.addEventListener('touchstart',event => {
      if (event.touches.length !== 1 || event.target.closest('button')) {
        touchStart = null;return;
      }
      touchStart = {x:event.touches[0].clientX,y:event.touches[0].clientY};
    },{passive:true});
    paper.addEventListener('touchend',event => {
      if (!touchStart || event.changedTouches.length !== 1) return;
      const dx = event.changedTouches[0].clientX - touchStart.x;
      const dy = event.changedTouches[0].clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy)*1.5) turn(dx < 0 ? 1 : -1);
    },{passive:true});
    window.addEventListener('keydown',event => {
      if (event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]')) return;
      if (event.target.closest('input,textarea,select,[contenteditable],button,a')) return;
      const rect = paper.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();turn(event.key === 'ArrowRight' ? 1 : -1);
      }
    });

    render();
    quoteButton.addEventListener('click',async()=>{
      const selection = window.getSelection();
      const selected = selection && selection.rangeCount &&
        paper.contains(selection.anchorNode) && paper.contains(selection.focusNode)
          ? selection.toString().replace(/\s+/g,' ').trim() : '';
      const epigraph = (root.querySelector('.reading-header .epigraph')?.textContent || '').trim().replace(/^“|”$/g,'');
      const visibleLeaf = leaves[current];
      const first = visibleLeaf.querySelector('p:not(.reader-note):not(.chapter-signature)');
      const quotation = (selected.length >= 15 ? selected : (epigraph || first?.textContent || '')).trim().slice(0,380);
      if (!quotation) return;
      const title = (root.querySelector('.reading-header h1')?.textContent || 'Um manuscrito').trim();
      try {await showCard(quotation,title);}
      catch(err) {window.alert('Não foi possível gerar a imagem neste navegador. Tente novamente.');}
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
