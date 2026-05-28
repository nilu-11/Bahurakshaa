-- Align profile roles with the application RBAC model.
-- The frontend supports: admin, ops, analyst, field, viewer.
-- Older profiles used 'user', which the UI displayed as viewer but RLS did not allow.

UPDATE public.profiles
SET role = 'viewer',
    updated_at = now()
WHERE role = 'user';

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'viewer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_valid'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_valid
      CHECK (role IN ('admin', 'ops', 'analyst', 'field', 'viewer'));
  END IF;
END $$;
