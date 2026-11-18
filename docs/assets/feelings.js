/* Ms. Addams — classificação editorial inicial dos manuscritos existentes.
 * Não muda textos e respeita categorias já escolhidas que não sejam "Outras reflexões".
 * A autoria pode confirmar as sugestões no Gabinete e gravá-las no Supabase.
 */
(() => {
  'use strict';
  const normalized = value => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const tags = {
    'desventura em serie': 'desilusoes',
    'quantas vezes um coracao pode se quebrar': 'amor',
    'quando o medo se disfarca de intuicao': 'autoconhecimento',
    'quando a amizade se torna conveniencia': 'amizade',
    'e se alguem realmente quiser ficar': 'amor'
  };
  function recommendation(chapter) {
    if (!chapter) return null;
    return tags[normalized(chapter.title)] || null;
  }
  function effective(chapter) {
    const stored = String(chapter?.feeling_theme || 'outros');
    return stored !== 'outros' ? stored : recommendation(chapter) || 'outros';
  }
  window.ADDAMS_FEELINGS = Object.freeze({recommendation,effective});
})();
