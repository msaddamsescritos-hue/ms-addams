-- Ms. Addams: registrar confirmação MANUAL de resposta enviada pelo Gmail.
-- Execute uma única vez no SQL Editor do Supabase.
-- Não exclui nem atualiza cartas já respondidas; preserva capítulos e visitas.
create or replace function public.mark_letter_replied(p_letter_id uuid, p_reply_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_site_admin() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  if p_reply_text is null or length(trim(p_reply_text)) not between 2 and 10000 then
    raise exception 'A resposta deve conter entre 2 e 10.000 caracteres.' using errcode = '22023';
  end if;
  update public.letters
     set status = 'replied',
         reply_text = trim(p_reply_text),
         replied_at = now()
   where id = p_letter_id
     and status = 'new';
  if not found then
    raise exception 'Carta não encontrada ou já respondida.' using errcode = 'P0002';
  end if;
end
$$;

revoke all on function public.mark_letter_replied(uuid, text) from public, anon;
grant execute on function public.mark_letter_replied(uuid, text) to authenticated;

comment on function public.mark_letter_replied(uuid,text) is
  'Somente a administradora pode confirmar manualmente uma resposta após enviá-la pelo Gmail.';
