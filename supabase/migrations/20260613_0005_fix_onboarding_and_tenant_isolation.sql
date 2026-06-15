-- Sprint 7.5: corrige onboarding e elimina auto-associacao a tenants

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_type TEXT
CHECK (account_type IN ('business_owner', 'customer'));

ALTER TABLE public.company_members
ALTER COLUMN role SET DEFAULT 'customer';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.create_company_onboarding(company_name TEXT)
RETURNS TABLE(company_id UUID, role TEXT) AS $$
DECLARE
  new_company_id UUID;
  safe_company_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Usuário já possui empresa vinculada.';
  END IF;

  safe_company_name := NULLIF(trim(company_name), '');

  IF safe_company_name IS NULL THEN
    RAISE EXCEPTION 'Nome da empresa é obrigatório.';
  END IF;

  INSERT INTO public.companies (name, slug)
  VALUES (
    safe_company_name,
    lower(regexp_replace(safe_company_name, '[^a-zA-Z0-9]+', '-', 'g'))
  )
  RETURNING id INTO new_company_id;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (new_company_id, auth.uid(), 'owner');

  UPDATE public.profiles
  SET account_type = 'business_owner',
      updated_at = now()
  WHERE id = auth.uid();

  RETURN QUERY SELECT new_company_id, 'owner'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_company_onboarding(TEXT) TO authenticated;
