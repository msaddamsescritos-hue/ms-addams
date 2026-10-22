// Contagem aproximada de visitas por sessao (30 minutos), sem IP nem email na tabela.
// Depende da funcao public.register_site_visit() criada pelo SQL de estatisticas.
(() => {
  'use strict';
  // Oculta o parâmetro de origem do ChatGPT sem alterar outros parâmetros.
  try {
    const pageUrl = new URL(window.location.href);
    if (pageUrl.searchParams.get('utm_source') === 'chatgpt.com') {
      pageUrl.searchParams.delete('utm_source');
      window.history.replaceState(window.history.state, '', pageUrl.pathname + pageUrl.search + pageUrl.hash);
    }
  } catch (_) { /* sem impacto no site */ }
  // A exclusão é ativada apenas após autenticação e autorização de administradora no gabinete.
  // O marcador vale para este navegador, inclusive depois de sair do painel.
  try {
    if (window.localStorage.getItem('msaddams_owner_visit_exclusion_v1') === '1') return;
  } catch (_) { /* se armazenamento estiver bloqueado, a contagem continua normalmente */ }
  const cfg = window.ADDAMS_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabasePublishableKey || !window.supabase) return;
  const storeKey = 'msaddams_anon_visit_v1';
  const halfHour = 30 * 60 * 1000;
  const now = Date.now();
  let visit = null;
  try { visit = JSON.parse(sessionStorage.getItem(storeKey) || 'null'); } catch (_) { /* modo restrito */ }
  if (!visit || typeof visit.id !== 'string' || !Number.isFinite(visit.started) || now - visit.started > halfHour || now < visit.started) {
    visit = {id: crypto.randomUUID(), started: now};
    try { sessionStorage.setItem(storeKey, JSON.stringify(visit)); } catch (_) { /* segue sem armazenamento */ }
  }
  try {
    const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
      auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}
    });
    client.rpc('register_site_visit', {p_visit_id: visit.id}).then(({error}) => {
      if (error) console.info('Estatisticas temporariamente indisponiveis.');
    }).catch(() => {});
  } catch (_) { /* nao interfere na leitura do site */ }
})();
