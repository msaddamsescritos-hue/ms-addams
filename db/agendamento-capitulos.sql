-- Ms. Addams — Agendamento seguro de manuscritos (executar uma vez no SQL Editor).
-- Nenhum dado existente é apagado. Não requer senha ou chave secreta.
-- Capítulos agendados só ficam visíveis a partir de scheduled_at.
begin;

alter table public.chapters
  add column if not exists scheduled_at timestamptz;

create index if not exists idx_chapters_scheduled_at
  on public.chapters (scheduled_at)
  where scheduled_at is not null;

-- Segurança: o público não consegue consultar capítulos futuros
-- diretamente pela API REST do Supabase.
drop policy if exists "Publico le apenas capitulos publicados" on public.chapters;
create policy "Publico le apenas capitulos publicados"
  on public.chapters for select to anon
  using (
    (published = true and scheduled_at is null)
    or (scheduled_at is not null and scheduled_at <= now())
  );

drop policy if exists "Admin le todos os capitulos" on public.chapters;
create policy "Admin le todos os capitulos"
  on public.chapters for select to authenticated
  using (
    public.is_site_admin()
    or (published = true and scheduled_at is null)
    or (scheduled_at is not null and scheduled_at <= now())
  );

commit;

-- Verificação opcional: conferir coluna e políticas.
-- select column_name,data_type from information_schema.columns
-- where table_schema='public' and table_name='chapters' and column_name='scheduled_at';
-- select policyname,roles,qual from pg_policies
-- where schemaname='public' and tablename='chapters' and cmd='SELECT';
