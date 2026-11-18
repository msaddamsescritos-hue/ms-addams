/* Ms. Addams — tema ilustrado para manuscritos. Apenas visual: não acessa credenciais ou banco de dados. */
(function () {
  'use strict';
  if (!document.body || document.body.getAttribute('data-page') !== 'chapter') return;
  if (!document.getElementById('ms-addams-paper-styles')) {
    var link = document.createElement('link');
    link.id = 'ms-addams-paper-styles';
    link.rel = 'stylesheet';
    link.href = 'papel-addams.css';
    document.head.appendChild(link);
  }
  var root = document.getElementById('chapter-content');
  if (!root) return;
  function applyPaper() {
    var paper = root.querySelector('.reading-paper');
    if (!paper) return;
    var header = root.querySelector('.reading-header .kicker');
    var match = header && header.textContent.match(/\d+/);
    var number = match ? Number(match[0]) : 1;
    var themes = ['discreto', 'romantico', 'sofisticado'];
    paper.setAttribute('data-paper-theme', themes[(Math.max(1, number) - 1) % themes.length]);
  }
  var observer = new MutationObserver(applyPaper);
  observer.observe(root, {childList: true, subtree: true});
  applyPaper();
})();
