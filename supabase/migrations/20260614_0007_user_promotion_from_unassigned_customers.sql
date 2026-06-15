-- Sprint 7.5: listar e promover customers sem company_members com validacao de owner

CREATE OR REPLACE FUNCTION public.list_unassigned_customer_profiles()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  account_type TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para listar usuários disponíveis.';
  END IF;

  RETURN QUERY
  SELECT
    profile.id,
    profile.full_name,
    profile.email,
    profile.account_type,
    profile.created_at
  FROM public.profiles profile
  WHERE COALESCE(profile.account_type, 'customer') = 'customer'
    AND NOT EXISTS (
      SELECT 1
      FROM public.company_members member
      WHERE member.user_id = profile.id
    )
  ORDER BY profile.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.list_unassigned_customer_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.promote_customer_to_company(
  target_user_id UUID,
  target_company_id UUID,
  target_role TEXT
)
RETURNS TABLE (member_id UUID) AS $$
DECLARE
  new_member_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF target_role NOT IN ('owner', 'admin', 'operator') THEN
    RAISE EXCEPTION 'Role inválido para promoção.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = target_company_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Apenas owner pode promover usuários.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = target_user_id
      AND COALESCE(account_type, 'customer') = 'customer'
  ) THEN
    RAISE EXCEPTION 'Usuário customer não encontrado.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'Usuário já possui vínculo com uma empresa.';
  END IF;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (target_company_id, target_user_id, target_role)
  RETURNING id INTO new_member_id;

  UPDATE public.profiles
  SET account_type = 'business_owner',
      updated_at = now()
  WHERE id = target_user_id;

  RETURN QUERY SELECT new_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.promote_customer_to_company(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_company_member_profile_name(
  target_user_id UUID,
  target_company_id UUID,
  target_full_name TEXT
)
RETURNS VOID AS $$
DECLARE
  safe_full_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  safe_full_name := NULLIF(trim(target_full_name), '');

  IF safe_full_name IS NULL THEN
    RAISE EXCEPTION 'Nome é obrigatório.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = target_company_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Apenas owner pode editar nomes da equipe.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = target_company_id
      AND user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence a esta empresa.';
  END IF;

  UPDATE public.profiles
  SET full_name = safe_full_name,
      updated_at = now()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.update_company_member_profile_name(UUID, UUID, TEXT) TO authenticated;
