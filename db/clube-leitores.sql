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
