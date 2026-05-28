-- RBAC helper functions
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'anonymous');
$$;

CREATE OR REPLACE FUNCTION public.has_role(roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = ANY (roles)
  );
$$;

-- Alerts
DROP POLICY IF EXISTS "Alerts are publicly readable" ON public.alerts;
DROP POLICY IF EXISTS "Alerts readable by staff" ON public.alerts;
DROP POLICY IF EXISTS "Alerts write by ops" ON public.alerts;
DROP POLICY IF EXISTS "Alerts update by ops" ON public.alerts;
CREATE POLICY "Alerts readable by staff"
  ON public.alerts
  FOR SELECT
  USING (public.has_role(ARRAY['admin','ops','analyst','field','viewer']));
CREATE POLICY "Alerts write by ops"
  ON public.alerts
  FOR INSERT
  WITH CHECK (public.has_role(ARRAY['admin','ops']));
CREATE POLICY "Alerts update by ops"
  ON public.alerts
  FOR UPDATE
  USING (public.has_role(ARRAY['admin','ops']))
  WITH CHECK (public.has_role(ARRAY['admin','ops']));

-- Citizen reports
DROP POLICY IF EXISTS "Reports are publicly readable" ON public.citizen_reports;
DROP POLICY IF EXISTS "Anyone can submit reports" ON public.citizen_reports;
DROP POLICY IF EXISTS "Reports readable by staff" ON public.citizen_reports;
DROP POLICY IF EXISTS "Reports insert by field" ON public.citizen_reports;
DROP POLICY IF EXISTS "Reports update by ops" ON public.citizen_reports;
CREATE POLICY "Reports readable by staff"
  ON public.citizen_reports
  FOR SELECT
  USING (public.has_role(ARRAY['admin','ops','analyst','field','viewer']));
CREATE POLICY "Reports insert by field"
  ON public.citizen_reports
  FOR INSERT
  WITH CHECK (public.has_role(ARRAY['admin','ops','field']));
CREATE POLICY "Reports update by ops"
  ON public.citizen_reports
  FOR UPDATE
  USING (public.has_role(ARRAY['admin','ops']))
  WITH CHECK (public.has_role(ARRAY['admin','ops']));

-- Data sources
DROP POLICY IF EXISTS "Data sources are publicly readable" ON public.data_sources;
DROP POLICY IF EXISTS "Data sources readable by staff" ON public.data_sources;
CREATE POLICY "Data sources readable by staff"
  ON public.data_sources
  FOR SELECT
  USING (public.has_role(ARRAY['admin','ops','analyst','field','viewer']));

-- Risk zones
DROP POLICY IF EXISTS "Risk zones are publicly readable" ON public.risk_zones;
DROP POLICY IF EXISTS "Risk zones readable by staff" ON public.risk_zones;
CREATE POLICY "Risk zones readable by staff"
  ON public.risk_zones
  FOR SELECT
  USING (public.has_role(ARRAY['admin','ops','analyst','field','viewer']));

-- River stations
DROP POLICY IF EXISTS "River stations are publicly readable" ON public.river_stations;
DROP POLICY IF EXISTS "River stations readable by staff" ON public.river_stations;
CREATE POLICY "River stations readable by staff"
  ON public.river_stations
  FOR SELECT
  USING (public.has_role(ARRAY['admin','ops','analyst','field','viewer']));

-- River level observations
DROP POLICY IF EXISTS "River level observations are publicly readable" ON public.river_level_observations;
DROP POLICY IF EXISTS "River level observations readable by staff" ON public.river_level_observations;
CREATE POLICY "River level observations readable by staff"
  ON public.river_level_observations
  FOR SELECT
  USING (public.has_role(ARRAY['admin','ops','analyst','field','viewer']));

-- Rainfall forecasts
DROP POLICY IF EXISTS "Rainfall forecasts are publicly readable" ON public.rainfall_forecasts;
DROP POLICY IF EXISTS "Rainfall forecasts readable by staff" ON public.rainfall_forecasts;
CREATE POLICY "Rainfall forecasts readable by staff"
  ON public.rainfall_forecasts
  FOR SELECT
  USING (public.has_role(ARRAY['admin','ops','analyst','field','viewer']));

-- Satellite products
DROP POLICY IF EXISTS "Satellite products are publicly readable" ON public.satellite_products;
DROP POLICY IF EXISTS "Satellite products readable by staff" ON public.satellite_products;
CREATE POLICY "Satellite products readable by staff"
  ON public.satellite_products
  FOR SELECT
  USING (public.has_role(ARRAY['admin','ops','analyst','field','viewer']));

-- Glacial lakes
DROP POLICY IF EXISTS "Glacial lakes are publicly readable" ON public.glacial_lakes;
DROP POLICY IF EXISTS "Glacial lakes readable by staff" ON public.glacial_lakes;
CREATE POLICY "Glacial lakes readable by staff"
  ON public.glacial_lakes
  FOR SELECT
  USING (public.has_role(ARRAY['admin','ops','analyst','field','viewer']));

-- Sentinel scenes
DROP POLICY IF EXISTS "Sentinel scenes are publicly readable" ON public.sentinel_scenes;
DROP POLICY IF EXISTS "Sentinel scenes readable by staff" ON public.sentinel_scenes;
CREATE POLICY "Sentinel scenes readable by staff"
  ON public.sentinel_scenes
  FOR SELECT
  USING (public.has_role(ARRAY['admin','ops','analyst','field','viewer']));

-- Risk zone assessments
DROP POLICY IF EXISTS "Risk zone assessments are publicly readable" ON public.risk_zone_assessments;
DROP POLICY IF EXISTS "Risk zone assessments readable by staff" ON public.risk_zone_assessments;
CREATE POLICY "Risk zone assessments readable by staff"
  ON public.risk_zone_assessments
  FOR SELECT
  USING (public.has_role(ARRAY['admin','ops','analyst','field','viewer']));

-- Profiles: allow admins to view and update roles
DROP POLICY IF EXISTS "Admins can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can view profiles"
  ON public.profiles
  FOR SELECT
  USING (public.has_role(ARRAY['admin']));
CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.has_role(ARRAY['admin']))
  WITH CHECK (public.has_role(ARRAY['admin']));
