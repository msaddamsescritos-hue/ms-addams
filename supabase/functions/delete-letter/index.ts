import { cors, json, isUuid, verifyAdmin } from '../_shared/mod.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json({ error: 'Solicitação inválida.' }, 400); }
  if (!isUuid(payload?.letterId)) return json({ error: 'Carta inválida.' }, 422);
  try {
    const { server, error } = await verifyAdmin(request);
    if (error || !server) return error || json({ error: 'Acesso não autorizado.' }, 403);
    const { data, error: deletionError } = await server.from('letters').delete().eq('id', payload.letterId).select('id').maybeSingle();
    if (deletionError) throw deletionError;
    return json({ ok: true, deleted: Boolean(data) });
  } catch { return json({ error: 'Não foi possível excluir a carta.' }, 503); }
});
