-- Sprint 7: cadastro comum vira customer e base de usuários/permissões

ALTER TABLE public.company_members
ALTER COLUMN role SET DEFAULT 'customer';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  target_company_id UUID;
  target_role TEXT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );

  SELECT id INTO target_company_id
  FROM public.companies
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_company_id IS NULL THEN
    INSERT INTO public.companies (name, slug)
    VALUES ('Delícias da Marli', 'delicias-da-marli')
    RETURNING id INTO target_company_id;

    target_role := 'owner';
  ELSE
    target_role := 'customer';
  END IF;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (target_company_id, NEW.id, target_role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "profiles_select_company_admin" ON public.profiles;
CREATE POLICY "profiles_select_company_admin"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.company_members target_member
    JOIN public.company_members current_member
      ON current_member.company_id = target_member.company_id
    WHERE target_member.user_id = profiles.id
      AND current_member.user_id = auth.uid()
      AND current_member.role IN ('owner', 'admin')
  )
);
