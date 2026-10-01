-- Vouchers da Vitrine, concedidos à mão pela equipe. Separados de cb_extras de propósito:
-- lá uma "indicação" também soma 25 pontos no placar, e o voucher manual não mexe em pontos.
-- O mentorado só vê os próprios; resgatar ainda é combinado com a equipe, fora do sistema.
CREATE TABLE IF NOT EXISTS public.cb_vouchers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES public.members(id),
  origin      text NOT NULL CHECK (length(origin) BETWEEN 1 AND 300),
  note        text CHECK (length(note) <= 1000),
  status      text NOT NULL DEFAULT 'em_maos' CHECK (status IN ('em_maos','resgatado','expirado')),
  granted_on  date NOT NULL DEFAULT current_date,
  created_by  uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cb_vouchers_member ON public.cb_vouchers (member_id);

ALTER TABLE public.cb_vouchers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cb_vouchers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_vouchers TO authenticated;

DROP POLICY IF EXISTS own_read ON public.cb_vouchers;
CREATE POLICY own_read ON public.cb_vouchers FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) OR member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()) AND ativo));
DROP POLICY IF EXISTS admin_insert ON public.cb_vouchers;
CREATE POLICY admin_insert ON public.cb_vouchers FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
DROP POLICY IF EXISTS admin_update ON public.cb_vouchers;
CREATE POLICY admin_update ON public.cb_vouchers FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
DROP POLICY IF EXISTS admin_delete ON public.cb_vouchers;
CREATE POLICY admin_delete ON public.cb_vouchers FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

CREATE OR REPLACE FUNCTION cerebro_private.voucher_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
begin
  if tg_op = 'INSERT' then new.created_by = auth.uid(); new.created_at = now(); end if;
  if tg_op = 'UPDATE' and new.member_id <> old.member_id then raise exception 'Não é permitido transferir o voucher'; end if;
  new.updated_at = now();
  return new;
end$$;
DROP TRIGGER IF EXISTS voucher_stamp ON public.cb_vouchers;
CREATE TRIGGER voucher_stamp BEFORE INSERT OR UPDATE ON public.cb_vouchers
  FOR EACH ROW EXECUTE FUNCTION cerebro_private.voucher_stamp();
