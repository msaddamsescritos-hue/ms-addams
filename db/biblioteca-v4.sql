-- Ms. Addams | Biblioteca 4.0: radar, reações, sentimentos e organização de cartas.
-- Migração adicional para executar APÓS db/biblioteca-v3.sql e db/agendamento-capitulos.sql.
-- Não apaga capítulos, cartas, estatísticas ou versões anteriores.
begin;

alter table public.chapters
  add column if not exists feeling_theme text not null default 'outros'
  check (feeling_theme in ('amor','amizade','desilusoes','recomecos','autoconhecimento','outros'));
alter table public.chapters
  add column if not exists closing_note text not null default ''
  check (char_length(closing_note)<=600);
create index if not exists idx_chapters_feeling on public.chapters(feeling_theme);

-- Classificação privada de correspondências, sem alterar o conteúdo recebido.
alter table public.letters
  add column if not exists topic text not null default ''
  check (char_length(topic)<=80);
create index if not exists idx_letters_topic on public.letters(topic);

create or replace function public.set_letter_topic(p_id uuid,p_topic text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_site_admin() then raise exception 'Acesso não autorizado'; end if;
  if p_topic is null or char_length(btrim(p_topic)) > 80 then
    raise exception 'Assunto inválido'; end if;
  update public.letters
     set topic=btrim(p_topic)
   where id=p_id;
end $$;
revoke all on function public.set_letter_topic(uuid,text) from public,anon,authenticated;
grant execute on function public.set_letter_topic(uuid,text) to authenticated;

-- Sessões de leitura por capítulo: UUID aleatório por aba, sem IP, e-mail ou nome.
-- Um mesmo navegador pode iniciar sessões diferentes; contagens não são pessoas únicas.
create table if not exists public.chapter_read_sessions_v4 (
 chapter_slug text not null,
 session_token uuid not null,
 max_percent smallint not null default 0 check (max_percent between 0 and 100),
 completed boolean not null default false,
 started_at timestamptz not null default now(),
 last_activity timestamptz not null default now(),
 primary key (chapter_slug,session_token)
);
create index if not exists idx_read_sessions_chapter on public.chapter_read_sessions_v4(chapter_slug,max_percent,completed);
alter table public.chapter_read_sessions_v4 enable row level security;
revoke all on public.chapter_read_sessions_v4 from public,anon,authenticated;

create or replace function public.track_chapter_progress_v4(
 p_slug text,p_session uuid,p_percent integer,p_completed boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare released boolean;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9-]{1,140}$' or
     p_session is null or p_percent is null or p_percent not between 0 and 100 then return; end if;
  select exists(
   select 1 from public.chapters c
    where c.slug=p_slug and
      ((c.published=true and c.scheduled_at is null) or
       (c.scheduled_at is not null and c.scheduled_at<=now()))
  ) into released;
  if not released then return; end if;
  insert into public.chapter_read_sessions_v4
   (chapter_slug,session_token,max_percent,completed)
  values (p_slug,p_session,p_percent,coalesce(p_completed,false) and p_percent=100)
  on conflict(chapter_slug,session_token)
  do update set
    max_percent=greatest(public.chapter_read_sessions_v4.max_percent,excluded.max_percent),
    completed=(public.chapter_read_sessions_v4.completed or excluded.completed),
    last_activity=now();
end $$;
revoke all on function public.track_chapter_progress_v4(text,uuid,integer,boolean)
  from public,anon,authenticated;
grant execute on function public.track_chapter_progress_v4(text,uuid,integer,boolean)
  to anon,authenticated;

-- Votação única no mesmo navegador por capítulo. Token aleatório, não identifica pessoa.
create table if not exists public.chapter_reaction_votes_v4(
 chapter_slug text not null,
 vote_token uuid not null,
 reaction text not null check(reaction in ('identificacao','reflexao','acolhimento')),
 updated_at timestamptz not null default now(),
 primary key(chapter_slug,vote_token)
);
create index if not exists idx_reaction_votes_chapter
 on public.chapter_reaction_votes_v4(chapter_slug,reaction);
alter table public.chapter_reaction_votes_v4 enable row level security;
revoke all on public.chapter_reaction_votes_v4 from public,anon,authenticated;

create or replace function public.vote_chapter_reaction_v4(
 p_slug text,p_vote uuid,p_reaction text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_slug is null or p_slug !~ '^[a-z0-9-]{1,140}$' or p_vote is null or
    p_reaction not in ('identificacao','reflexao','acolhimento') then return;end if;
 if not exists(
  select 1 from public.chapters c where c.slug=p_slug
   and ((c.published=true and c.scheduled_at is null)
        or (c.scheduled_at is not null and c.scheduled_at<=now()))
 ) then return;end if;
 insert into public.chapter_reaction_votes_v4(chapter_slug,vote_token,reaction)
 values(p_slug,p_vote,p_reaction)
 on conflict(chapter_slug,vote_token)
 do update set reaction=excluded.reaction,updated_at=now();
end $$;
revoke all on function public.vote_chapter_reaction_v4(text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.vote_chapter_reaction_v4(text,uuid,text)
  to anon,authenticated;

-- Exibir somente total público de reações, nunca votos ou tokens individuais.
create or replace function public.chapter_reaction_totals_v4(p_slug text)
returns table(reaction text,total bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(
  select 1 from public.chapters c where c.slug=p_slug
   and ((c.published=true and c.scheduled_at is null)
        or (c.scheduled_at is not null and c.scheduled_at<=now()))
 ) then return;end if;
 return query
 select r.reaction,count(*)::bigint
 from public.chapter_reaction_votes_v4 r
 where r.chapter_slug=p_slug
 group by r.reaction;
end $$;
revoke all on function public.chapter_reaction_totals_v4(text) from public,anon,authenticated;
grant execute on function public.chapter_reaction_totals_v4(text) to anon,authenticated;

-- Radar privado: total desde a instalação, marcos de 25/50/75% e conclusões.
create or replace function public.chapter_engagement_summary_v4()
returns table(
 slug text,chapter_title text,
 started_count bigint,completed_count bigint,
 reached_25 bigint,reached_50 bigint,reached_75 bigint,
 below_half bigint,identification_count bigint,reflection_count bigint,comfort_count bigint
)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_site_admin() then raise exception 'Acesso não autorizado'; end if;
 return query
 select c.slug,c.title,
  count(s.session_token)::bigint,
  count(s.session_token) filter(where s.completed)::bigint,
  count(s.session_token) filter(where s.max_percent>=25)::bigint,
  count(s.session_token) filter(where s.max_percent>=50)::bigint,
  count(s.session_token) filter(where s.max_percent>=75)::bigint,
  count(s.session_token) filter(where s.max_percent<50 and not s.completed)::bigint,
  (select count(*) from public.chapter_reaction_votes_v4 v
    where v.chapter_slug=c.slug and v.reaction='identificacao')::bigint,
  (select count(*) from public.chapter_reaction_votes_v4 v
    where v.chapter_slug=c.slug and v.reaction='reflexao')::bigint,
  (select count(*) from public.chapter_reaction_votes_v4 v
    where v.chapter_slug=c.slug and v.reaction='acolhimento')::bigint
 from public.chapters c
 left join public.chapter_read_sessions_v4 s on s.chapter_slug=c.slug
 group by c.slug,c.title,c.number
 order by c.number;
end $$;
revoke all on function public.chapter_engagement_summary_v4() from public,anon,authenticated;
grant execute on function public.chapter_engagement_summary_v4() to authenticated;

-- Arquivo de versões também pode preservar as novas opções editoriais.
alter table public.chapter_versions add column if not exists feeling_theme text;
alter table public.chapter_versions add column if not exists closing_note text;
create or replace function public.archive_chapter_version() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.title is distinct from new.title or old.epigraph is distinct from new.epigraph or
    old.body is distinct from new.body or old.cover_theme is distinct from new.cover_theme or
    old.paper_theme is distinct from new.paper_theme or old.feeling_theme is distinct from new.feeling_theme or
    old.closing_note is distinct from new.closing_note then
   insert into public.chapter_versions
    (chapter_id,title,epigraph,body,cover_theme,paper_theme,feeling_theme,closing_note)
   values
    (old.id,old.title,old.epigraph,old.body,old.cover_theme,old.paper_theme,old.feeling_theme,old.closing_note);
 end if;
 return new;
end $$;

commit;
