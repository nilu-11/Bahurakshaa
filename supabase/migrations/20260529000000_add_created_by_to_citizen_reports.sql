-- Add created_by column to track report submitter
ALTER TABLE public.citizen_reports
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster queries on user reports
CREATE INDEX IF NOT EXISTS citizen_reports_created_by_idx ON public.citizen_reports(created_by);

-- Update RLS policies
DROP POLICY IF EXISTS "Reports readable by staff" ON public.citizen_reports;
DROP POLICY IF EXISTS "Reports insert by field and viewers" ON public.citizen_reports;
DROP POLICY IF EXISTS "Viewers see own reports" ON public.citizen_reports;

-- Staff can see all reports
CREATE POLICY "Reports readable by staff"
  ON public.citizen_reports
  FOR SELECT
  USING (public.has_role(ARRAY['admin','ops','analyst','field']));

-- Viewers can only see their own reports
CREATE POLICY "Viewers see own reports"
  ON public.citizen_reports
  FOR SELECT
  USING (public.has_role(ARRAY['viewer']) AND created_by = auth.uid());

-- Field staff and viewers can submit
CREATE POLICY "Reports insert by field and viewers"
  ON public.citizen_reports
  FOR INSERT
  WITH CHECK (public.has_role(ARRAY['admin','ops','field','viewer']) AND created_by = auth.uid());
