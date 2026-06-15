-- Sprint 7.9: listagem segura de membros com profiles para evitar fallback em UUID

CREATE OR REPLACE FUNCTION public.list_company_members_with_profiles(
  target_company_id UUID
)
RETURNS TABLE (
  member_id UUID,
  company_id UUID,
  user_id UUID,
  role TEXT,
  member_created_at TIMESTAMPTZ,
  member_updated_at TIMESTAMPTZ,
  full_name TEXT,
  email TEXT,
  account_type TEXT
) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members current_member
    WHERE current_member.company_id = target_company_id
      AND current_member.user_id = auth.uid()
      AND current_member.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para listar membros desta empresa.';
  END IF;

  RETURN QUERY
  SELECT
    member.id,
    member.company_id,
    member.user_id,
    member.role,
    member.created_at,
    member.updated_at,
    profile.full_name,
    profile.email,
    profile.account_type
  FROM public.company_members member
  LEFT JOIN public.profiles profile
    ON profile.id = member.user_id
  WHERE member.company_id = target_company_id
  ORDER BY member.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.list_company_members_with_profiles(UUID) TO authenticated;
