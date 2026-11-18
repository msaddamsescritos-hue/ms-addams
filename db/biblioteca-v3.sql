-- MS. ADDAMS | Biblioteca e Gabinete 3.0 — 18/11/2026
-- Execute UMA VEZ no SQL Editor (Database). Não exclui manuscritos ou correspondências.
-- A instalação pode ser repetida sem duplicar políticas ou gatilhos.
begin;

alter table public.chapters add column if not exists cover_theme text not null default 'ameixa'
  check (cover_theme in ('ameixa','rosas','pena'));
alter table public.chapters add column if not exists paper_theme text not null default 'automatico'
  check (paper_theme in ('automatico','discreto','romantico','sofisticado'));
alter table public.chapters add column if not exists auto_notify boolean not null default false;

-- Versões salvas somente para alterações reais no conteúdo, sem acesso público.
create table if not exists public.chapter_versions (
 id bigint generated always as identity primary key,
 chapter_id uuid not null references public.chapters(id) on delete cascade,
 title text not null,
 epigraph text not null,
 body text not null,
 cover_theme text,
 paper_theme text,
 saved_at timestamptz not null default now()
);
create index if not exists chapter_versions_lookup on public.chapter_versions(chapter_id,saved_at desc);
create or replace function public.archive_chapter_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if old.title is distinct from new.title or old.epigraph is distinct from new.epigraph
    or old.body is distinct from new.body
    or old.cover_theme is distinct from new.cover_theme
    or old.paper_theme is distinct from new.paper_theme then
   insert into public.chapter_versions(chapter_id,title,epigraph,body,cover_theme,paper_theme)
   values (old.id,old.title,old.epigraph,old.body,old.cover_theme,old.paper_theme);
 end if;
 return new;
end $$;
drop trigger if exists chapters_archive_version on public.chapters;
create trigger chapters_archive_version before update on public.chapters
for each row execute function public.archive_chapter_version();
alter table public.chapter_versions enable row level security;
revoke all on public.chapter_versions from public,anon,authenticated;
grant select on public.chapter_versions to authenticated;
drop policy if exists "Versoes somente autora" on public.chapter_versions;
create policy "Versoes somente autora" on public.chapter_versions for select to authenticated
using (public.is_site_admin());

-- Cartas literárias escritas pela autora, diferentes das correspondências privadas dos leitores.
create table if not exists public.author_notes (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 160),
 body text not null check (char_length(body) between 1 and 8000),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists author_notes_visible on public.author_notes(published, created_at desc);
alter table public.author_notes enable row level security;
revoke all on public.author_notes from public,anon,authenticated;
grant select on public.author_notes to anon,authenticated;
grant insert,update,delete on public.author_notes to authenticated;
drop policy if exists "Cartas literarias publicas" on public.author_notes;
create policy "Cartas literarias publicas" on public.author_notes for select to anon
using (published = true);
drop policy if exists "Autora le todas cartas literarias" on public.author_notes;
create policy "Autora le todas cartas literarias" on public.author_notes for select to authenticated
using (public.is_site_admin() or published = true);
drop policy if exists "Autora cria cartas literarias" on public.author_notes;
create policy "Autora cria cartas literarias" on public.author_notes for insert to authenticated
with check (public.is_site_admin());
drop policy if exists "Autora edita cartas literarias" on public.author_notes;
create policy "Autora edita cartas literarias" on public.author_notes for update to authenticated
using (public.is_site_admin()) with check (public.is_site_admin());
drop policy if exists "Autora exclui cartas literarias" on public.author_notes;
create policy "Autora exclui cartas literarias" on public.author_notes for delete to authenticated
using (public.is_site_admin());

-- Revelação pública: apenas DATA, nunca título, texto, slug ou identidade da autora.
create or replace function public.next_manuscript_reveal() returns timestamptz
language sql stable security definer set search_path = '' as $$
select min(scheduled_at) from public.chapters
where scheduled_at > now() and published = false;
$$;
revoke all on function public.next_manuscript_reveal() from public,anon,authenticated;
grant execute on function public.next_manuscript_reveal() to anon,authenticated;

-- Contagem aproximada por capítulo, sem IP/e-mail/cookie ou identificador pessoal.
-- O navegador limita o registro a uma vez por capítulo a cada sessão de leitura.
create table if not exists public.chapter_read_events (
 id bigint generated always as identity primary key,
 chapter_slug text not null,
 created_at timestamptz not null default now()
);
create index if not exists chapter_read_events_slug on public.chapter_read_events(chapter_slug,created_at desc);
alter table public.chapter_read_events enable row level security;
revoke all on public.chapter_read_events from public,anon,authenticated;
create or replace function public.record_chapter_read(p_slug text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_slug is null or length(p_slug)>140 or p_slug !~ '^[a-z0-9-]+$' then return; end if;
 if exists (
   select 1 from public.chapters c where c.slug=p_slug
     and ((c.published=true and c.scheduled_at is null)
          or (c.scheduled_at is not null and c.scheduled_at <= now()))
 ) then
   insert into public.chapter_read_events(chapter_slug) values(p_slug);
 end if;
end $$;
revoke all on function public.record_chapter_read(text) from public,anon,authenticated;
grant execute on function public.record_chapter_read(text) to anon,authenticated;

create or replace function public.chapter_read_summary()
returns table (slug text, chapter_title text, total_reads bigint, recent_reads bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.is_site_admin() then raise exception 'Access denied'; end if;
 return query
 select c.slug,c.title,
   count(v.id)::bigint,
   count(v.id) filter (where v.created_at >= now()-interval '7 days')::bigint
 from public.chapters c left join public.chapter_read_events v on v.chapter_slug=c.slug
 group by c.slug,c.title,c.number order by count(v.id) desc,c.number;
end $$;
revoke all on function public.chapter_read_summary() from public,anon,authenticated;
grant execute on function public.chapter_read_summary() to authenticated;
commit;
