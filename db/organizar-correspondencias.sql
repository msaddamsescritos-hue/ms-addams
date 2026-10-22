-- Ms. Addams — organização de correspondências, sem excluir dados existentes.
-- Execute no SQL Editor do Supabase do projeto correto.
-- Idempotente: pode ser executado novamente sem limpar nenhuma tabela.

alter table public.letters add column if not exists read_at timestamptz;
alter table public.letters add column if not exists archived_at timestamptz;
alter table public.letters add column if not exists draft_reply text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'letters_draft_reply_length'
      and conrelid = 'public.letters'::regclass
  ) then
    alter table public.letters add constraint letters_draft_reply_length
    check (draft_reply is null or char_length(draft_reply) <= 10000);
  end if;
end $$;

create index if not exists idx_letters_archive_status
on public.letters (archived_at, created_at desc);

create or replace function public.manage_letter(
  p_letter_id uuid,
  p_action text,
  p_text text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if not public.is_site_admin() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;

  if p_action = 'mark_read' then
    update public.letters set read_at = coalesce(read_at, now())
      where id = p_letter_id;
  elsif p_action = 'archive' then
    update public.letters set archived_at = coalesce(archived_at, now())
      where id = p_letter_id;
  elsif p_action = 'restore' then
    update public.letters set archived_at = null
      where id = p_letter_id;
  elsif p_action = 'save_draft' then
    if p_text is not null and char_length(p_text) > 10000 then
      raise exception 'Rascunho excede 10.000 caracteres.' using errcode = '22023';
    end if;
    update public.letters set draft_reply = p_text
      where id = p_letter_id and status = 'new';
  else
    raise exception 'Operação não permitida.' using errcode = '22023';
  end if;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Carta não encontrada ou alteração indisponível.' using errcode = 'P0002';
  end if;
end
$$;

revoke all on function public.manage_letter(uuid,text,text) from public, anon;
grant execute on function public.manage_letter(uuid,text,text) to authenticated;

comment on function public.manage_letter(uuid,text,text) is
'Permite que somente administradoras organizem cartas e salvem rascunhos, sem divulgar conteúdo publicamente.';
