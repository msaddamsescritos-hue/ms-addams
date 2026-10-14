-- Ms. Addams — executar uma única vez no SQL Editor do Supabase.
-- Não insira aqui o e-mail ou nome real da autora; use apenas a conta criada em Authentication > Users.
-- A seção no final indica como vincular o UUID da conta administradora.

create extension if not exists pgcrypto;

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  number integer unique not null check (number between 1 and 9999),
  slug text unique not null check (char_length(slug) between 1 and 140),
  title text not null check (char_length(title) between 1 and 180),
  epigraph text not null default '' check (char_length(epigraph) <= 1000),
  body text not null check (char_length(body) between 1 and 100000),
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_has_date check (not published or published_at is not null)
);

create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  alias text not null check (char_length(alias) between 1 and 80),
  email text not null check (char_length(email) between 5 and 254),
  message text not null check (char_length(message) between 1 and 5000),
  status text not null default 'new' check (status in ('new','sending','replied')),
  reply_text text check (reply_text is null or char_length(reply_text) <= 10000),
  replied_at timestamptz,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_chapters_public on public.chapters (published, number);
create index if not exists idx_letters_recent on public.letters (created_at desc);

create or replace function public.is_site_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.site_admins s where s.user_id = (select auth.uid()));
$$;

create or replace function public.set_chapter_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists chapter_modified on public.chapters;
create trigger chapter_modified before update on public.chapters
for each row execute function public.set_chapter_updated_at();

alter table public.site_admins enable row level security;
alter table public.chapters enable row level security;
alter table public.letters enable row level security;

revoke all on public.site_admins from anon, authenticated;
revoke all on public.chapters from anon, authenticated;
revoke all on public.letters from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.chapters to anon;
grant select, insert, update, delete on public.chapters to authenticated;
grant select on public.site_admins to authenticated;
grant select on public.letters to authenticated;
-- Resposta por e-mail e mudança de status são feitas APENAS na função de servidor.
grant execute on function public.is_site_admin() to authenticated;
revoke execute on function public.is_site_admin() from public, anon;

-- Recriar políticas idempotentemente.
drop policy if exists "Admin enxerga a propria permissao" on public.site_admins;
create policy "Admin enxerga a propria permissao" on public.site_admins
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Publico le apenas capitulos publicados" on public.chapters;
create policy "Publico le apenas capitulos publicados" on public.chapters
for select to anon using (published = true);

drop policy if exists "Admin le todos os capitulos" on public.chapters;
create policy "Admin le todos os capitulos" on public.chapters
for select to authenticated using (public.is_site_admin() or published = true);

drop policy if exists "Admin cria capitulos" on public.chapters;
create policy "Admin cria capitulos" on public.chapters
for insert to authenticated with check (public.is_site_admin());

drop policy if exists "Admin edita capitulos" on public.chapters;
create policy "Admin edita capitulos" on public.chapters
for update to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

drop policy if exists "Admin exclui capitulos" on public.chapters;
create policy "Admin exclui capitulos" on public.chapters
for delete to authenticated using (public.is_site_admin());

drop policy if exists "Admin le cartas" on public.letters;
create policy "Admin le cartas" on public.letters
for select to authenticated using (public.is_site_admin());

-- O primeiro capítulo nasce como RASCUNHO, pois é apenas um trecho de apresentação.
-- Após colar o texto integral no painel, clique em Publicar.
insert into public.chapters (number,slug,title,epigraph,body,published)
values (
  1,
  'capitulo-1-desventura-em-serie',
  'Desventura em série',
  'Ultimamente, a vida tem se dedicado a me apresentar uma sucessão de desventuras. O curioso é que, em quase todas elas, o que mais me surpreende não é o acontecimento em si, mas a pessoa de quem ele veio.',
  E'É curioso como a decepção chega sem anunciar sua chegada. Elas simplesmente acontecem, muitas vezes disfarçadas de pequenos gestos, palavras mal colocadas ou silêncios que dizem mais do que gostaríamos de ouvir.\n\nUltimamente tenho me perguntado se o problema está nas pessoas que atravessam a minha vida ou na maneira como eu insisto em enxergá-las?\n\n[COLE AQUI O TEXTO INTEGRAL DO CAPÍTULO I ANTES DE PUBLICAR.]',
  false
) on conflict (number) do nothing;

-- DEPOIS de criar uma conta em Supabase > Authentication > Users,
-- copie o UUID real dela para substituir o texto abaixo e execute SEPARADAMENTE:
-- insert into public.site_admins (user_id) values ('UUID_DA_SUA_CONTA');
