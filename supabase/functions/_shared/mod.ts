import { createClient } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const serverClient = () => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Servidor não configurado.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};

export async function verifyAdmin(request: Request) {
  const token = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: json({ error: 'Entre novamente no painel.' }, 401) };
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) return { error: json({ error: 'Servidor não configurado.' }, 503) };
  const publicClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await publicClient.auth.getUser(token);
  if (error || !data?.user?.id) return { error: json({ error: 'Sua sessão expirou.' }, 401) };
  const server = serverClient();
  const { data: allowed, error: roleError } = await server.from('site_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (roleError || !allowed) return { error: json({ error: 'Operação não autorizada.' }, 403) };
  return { server };
}
