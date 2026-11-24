CREATE OR REPLACE FUNCTION public.is_center_member(_user_id uuid, _center_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _center_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_center_assignments
    WHERE user_id = _user_id AND center_id = _center_id)
$$;

DROP POLICY IF EXISTS "Staff can view own milk entries, admins see all" ON public.milk_entries;
CREATE POLICY "Center staff can view center milk entries" ON public.milk_entries FOR SELECT TO authenticated
USING (recorded_by = auth.uid() OR has_role(auth.uid(),'admin') OR is_center_member(auth.uid(), center_id));

DROP POLICY IF EXISTS "Staff can update own milk entries, admins update all" ON public.milk_entries;
CREATE POLICY "Center staff can update center milk entries" ON public.milk_entries FOR UPDATE TO authenticated
USING (recorded_by = auth.uid() OR has_role(auth.uid(),'admin') OR is_center_member(auth.uid(), center_id));

DROP POLICY IF EXISTS "Staff can view own farmers, admins see all" ON public.farmers;
CREATE POLICY "Center staff can view center farmers" ON public.farmers FOR SELECT TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(),'admin') OR is_center_member(auth.uid(), center_id));