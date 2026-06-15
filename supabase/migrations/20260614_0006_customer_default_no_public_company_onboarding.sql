-- Sprint 7.5 ajuste: cadastro comum sempre vira customer, sem criacao publica de empresa

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_type TEXT
CHECK (account_type IN ('business_owner', 'customer'));

UPDATE public.profiles profile
SET account_type = 'customer',
    updated_at = now()
WHERE profile.account_type IS NULL
AND NOT EXISTS (
  SELECT 1
  FROM public.company_members member
  WHERE member.user_id = profile.id
);

ALTER TABLE public.company_members
ALTER COLUMN role SET DEFAULT 'customer';

DROP FUNCTION IF EXISTS public.create_company_onboarding(TEXT);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, account_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    'customer'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    account_type = COALESCE(public.profiles.account_type, 'customer'),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
