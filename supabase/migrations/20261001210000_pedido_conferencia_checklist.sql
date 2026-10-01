-- O mentorado avisa que acha que já concluiu um item do checklist; a equipe confere.
-- Pedir não marca nada: só a equipe marca, em cb_checklist_progress. Quando o item é
-- marcado como feito, o pedido em aberto se fecha sozinho (gatilho abaixo).
CREATE TABLE IF NOT EXISTS public.cb_checklist_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid NOT NULL REFERENCES public.members(id),
  item_id      text NOT NULL REFERENCES public.cb_checklist_catalog(id),
  edition      text NOT NULL DEFAULT '',
  note         text CHECK (length(note) <= 1000),
  requested_by uuid DEFAULT auth.uid(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS cb_checklist_requests_aberto
  ON public.cb_checklist_requests (member_id, item_id, edition) WHERE resolved_at IS NULL;

ALTER TABLE public.cb_checklist_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cb_checklist_requests FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.cb_checklist_requests TO authenticated;

DROP POLICY IF EXISTS own_read ON public.cb_checklist_requests;
CREATE POLICY own_read ON public.cb_checklist_requests FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()) AND ativo));

DROP POLICY IF EXISTS own_request ON public.cb_checklist_requests;
CREATE POLICY own_request ON public.cb_checklist_requests FOR INSERT TO authenticated
  WITH CHECK (resolved_at IS NULL AND ((SELECT public.is_admin())
    OR member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()) AND ativo)));

DROP POLICY IF EXISTS admin_resolve ON public.cb_checklist_requests;
CREATE POLICY admin_resolve ON public.cb_checklist_requests FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- Carimbo: quem pede é sempre quem está logado, na hora do pedido.
CREATE OR REPLACE FUNCTION cerebro_private.checklist_request_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
begin
  new.requested_by = auth.uid(); new.requested_at = now(); new.resolved_at = null; new.resolved_by = null;
  return new;
end$$;
DROP TRIGGER IF EXISTS checklist_request_stamp ON public.cb_checklist_requests;
CREATE TRIGGER checklist_request_stamp BEFORE INSERT ON public.cb_checklist_requests
  FOR EACH ROW EXECUTE FUNCTION cerebro_private.checklist_request_stamp();

-- Item conferido fecha o pedido em aberto daquele mentorado e edição.
CREATE OR REPLACE FUNCTION cerebro_private.checklist_request_resolve()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
begin
  if new.done then
    update public.cb_checklist_requests set resolved_at = now(), resolved_by = auth.uid()
     where member_id = new.member_id and item_id = new.item_id and edition = new.edition and resolved_at is null;
  end if;
  return new;
end$$;
DROP TRIGGER IF EXISTS request_resolve ON public.cb_checklist_progress;
CREATE TRIGGER request_resolve AFTER INSERT OR UPDATE ON public.cb_checklist_progress
  FOR EACH ROW EXECUTE FUNCTION cerebro_private.checklist_request_resolve();
