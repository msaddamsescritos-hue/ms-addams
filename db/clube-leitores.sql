-- Ms. Addams • Clube de Leitores (instalação independente e sem apagar dados).
-- Execute no SQL Editor do Supabase usado pelo site.
-- Somente o servidor cadastra/atualiza inscrições; a autora pode consultar os inscritos.
create extension if not exists pgcrypto;

create table if not exists public.club_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  pseudonym text check (pseudonym is null or char_length(pseudonym) <= 80),
  status text not null default 'pending' check (status in ('pending','confirmed','unsubscribed')),
  consented_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  confirmation_hash text,
  confirmation_expires_at timestamptz,
  last_confirmation_sent_at timestamptz,
  last_action_mail_at timestamptz,
  last_unsubscribe_sent_at timestamptz,
  constraint club_email_valid check (char_length(email) between 5 and 254),
  constraint club_hash_valid check (confirmation_hash is null or char_length(confirmation_hash) = 64)
);

create index if not exists idx_club_subscribers_status on public.club_subscribers(status, created_at desc);
create index if not exists idx_club_subscribers_email on public.club_subscribers(email);

alter table public.club_subscribers enable row level security;
revoke all on public.club_subscribers from public, anon, authenticated;
grant select on public.club_subscribers to authenticated;

drop policy if exists "Somente autora pode consultar o clube" on public.club_subscribers;
create policy "Somente autora pode consultar o clube"
on public.club_subscribers
for select to authenticated
using (public.is_site_admin());

-- Não criar política pública de INSERT/UPDATE/DELETE.
-- Cadastro, confirmação e cancelamento ocorrem exclusivamente nas Edge Functions
-- usando credenciais privadas do servidor.

-- Controle de avisos: cada leitor recebe no máximo um aviso por capítulo,
-- mesmo que a autora clique novamente no botão. Falhas não são reenviadas
-- automaticamente para evitar mensagens duplicadas.
create table if not exists public.club_notification_sends (
  chapter_slug text not null,
  subscriber_id uuid not null references public.club_subscribers(id) on delete cascade,
  status text not null default 'sending' check (status in ('sending','sent','failed','skipped')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (chapter_slug,subscriber_id)
);
create index if not exists idx_club_notification_sends_status on public.club_notification_sends(status, chapter_slug);
alter table public.club_notification_sends enable row level security;
revoke all on public.club_notification_sends from public,anon,authenticated;
grant select on public.club_notification_sends to authenticated;
drop policy if exists "Somente autora consulta envios do clube" on public.club_notification_sends;
create policy "Somente autora consulta envios do clube"
on public.club_notification_sends for select to authenticated
using (public.is_site_admin());

-- Exclusivo para a função de servidor com SERVICE_ROLE. Reservar impede que
-- dois cliques simultâneos disparem o mesmo aviso duas vezes.
create or replace function public.club_claim_notification_batch(p_slug text, p_limit int default 10)
returns table (subscriber_id uuid, email text)
language sql
security definer
set search_path=''
as $$
with candidates as (
  select s.id,s.email from public.club_subscribers s
  where s.status='confirmed'
    and not exists (
      select 1 from public.club_notification_sends n
      where n.chapter_slug=p_slug and n.subscriber_id=s.id
    )
  order by s.confirmed_at asc nulls last
  limit least(greatest(coalesce(p_limit,10),1),10)
), reserved as (
  insert into public.club_notification_sends (chapter_slug,subscriber_id,status)
  select p_slug,c.id,'sending' from candidates c
  on conflict (chapter_slug,subscriber_id) do nothing
  returning club_notification_sends.subscriber_id
)
select c.id,c.email from candidates c
join reserved r on r.subscriber_id=c.id;
$$;
revoke all on function public.club_claim_notification_batch(text,int) from public,anon,authenticated;
grant execute on function public.club_claim_notification_batch(text,int) to service_role;
