// Contagem aproximada de visitas por sessao (30 minutos), sem IP nem email na tabela.
// Depende da funcao public.register_site_visit() criada pelo SQL de estatisticas.
(() => {
  'use strict';
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
