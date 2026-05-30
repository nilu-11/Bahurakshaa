-- Align runtime data-source metadata with the current local collection/training pipeline.
-- The UI still shows the source inventory from code, but these rows keep Supabase
-- operational metadata honest for dashboards and future admin tooling.

INSERT INTO public.data_sources (slug, name, provider, category, status, description, last_updated, metadata)
VALUES
  (
    'bipad-incidents',
    'BIPAD Incident Records',
    'Government of Nepal BIPAD',
    'ground-truth',
    'active',
    'Historical flood and landslide incident records used as supervised learning labels.',
    now(),
    '{"stage":"raw","artifact":"data/raw/bipad/incidents-*.csv","features":["event label","district","municipality","incident date"]}'::jsonb
  ),
  (
    'gpm-imerg',
    'GPM IMERG Daily Rainfall',
    'NASA GPM via Google Earth Engine',
    'weather',
    'active',
    'Daily Bagmati Basin rainfall export used for rolling rainfall features.',
    now(),
    '{"stage":"feature","script":"scripts/02_download_rainfall.py","artifact":"data/raw/rainfall/gpm_bagmati_daily.csv","features":["rf_1day","rf_3day","rf_7day","rf_30day"]}'::jsonb
  ),
  (
    'era5-land-runoff',
    'ERA5-Land Runoff and Soil Moisture',
    'ECMWF ERA5-Land via Google Earth Engine',
    'hydrology',
    'active',
    'Runoff and soil-water layers used as discharge and wetness proxies.',
    now(),
    '{"stage":"feature","script":"scripts/03_download_discharge.py","artifact":"data/raw/discharge/glofas_bagmati_daily.csv","features":["discharge_proxy","soil_moisture_index"]}'::jsonb
  ),
  (
    'sentinel-1-sar-training',
    'Sentinel-1 SAR Backscatter',
    'Copernicus Sentinel-1 via Google Earth Engine',
    'satellite',
    'active',
    'VV/VH SAR basin means aligned to training dates.',
    now(),
    '{"stage":"feature","script":"scripts/07_download_sar.py","artifact":"data/raw/sentinel/sentinel1_bagmati_daily.csv","features":["sar_vv_db","sar_vh_db","sar_vv_vh_ratio_db"]}'::jsonb
  ),
  (
    'srtm-dem',
    'SRTM Digital Elevation',
    'NASA SRTM / OpenTopography',
    'terrain',
    'active',
    'Terrain raster sampled into elevation and slope-derived predictors.',
    now(),
    '{"stage":"feature","artifact":"data/raw/dem/srtm_bagmati.tif","features":["elevation_m","slope_deg","aspect_deg","curvature","dist_drainage_m"]}'::jsonb
  ),
  (
    'esa-worldcover',
    'ESA WorldCover 10m',
    'ESA WorldCover public S3',
    'land-cover',
    'active',
    'Land-cover raster used for land-use code and NDVI proxy features.',
    now(),
    '{"stage":"feature","script":"scripts/01_download_worldcover.py","artifact":"data/raw/landuse/worldcover_nepal.tif","features":["landuse_code","ndvi_proxy"]}'::jsonb
  ),
  (
    'bagmati-boundary',
    'Bagmati Basin Boundary',
    'Project boundary file',
    'domain',
    'active',
    'Basin polygon used for domain filtering and validation.',
    now(),
    '{"stage":"feature","artifact":"data/raw/boundary/bagmatibasin.geojson","features":["basin mask","domain validation"]}'::jsonb
  ),
  (
    'training-tables',
    'Flood and Landslide Training Tables',
    'Bahurakshaa preprocessing',
    'training',
    'active',
    'Preprocessed feature tables for flood and landslide model training.',
    now(),
    '{"stage":"training","script":"scripts/05_preprocess.py","artifacts":["data/training/flood_training.csv","data/training/landslide_training.csv"]}'::jsonb
  ),
  (
    'hazard-models',
    'Flood and Landslide Models',
    'Bahurakshaa ML pipeline',
    'ml',
    'active',
    'XGBoost flood and landslide classifiers with validation-selected thresholds.',
    now(),
    '{"stage":"model","script":"scripts/06_train_models.py","artifacts":["models/flood_model.pkl","models/landslide_model.pkl"],"selected_model":"xgboost","thresholds":{"flood":0.30,"landslide":0.43}}'::jsonb
  ),
  (
    'hecras-routing',
    'HEC-RAS Routing Contract',
    'Bahurakshaa routing adapter',
    'hydraulic-model',
    'degraded',
    'HEC-RAS-style station routing contract, currently using scenario fallback when live outputs are absent.',
    now(),
    '{"stage":"operational","script":"scripts/parse_hecras.py","artifact":"data/raw/sample_river.hdf","mode":"scenario-fallback"}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  provider = EXCLUDED.provider,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  description = EXCLUDED.description,
  last_updated = EXCLUDED.last_updated,
  metadata = EXCLUDED.metadata;

UPDATE public.data_sources
SET
  status = 'degraded',
  description = 'Legacy seed source. Current rainfall features use NASA GPM IMERG via Google Earth Engine.',
  metadata = metadata || '{"replaced_by":"gpm-imerg"}'::jsonb
WHERE slug = 'gfs-forecast';

UPDATE public.data_sources
SET
  metadata = metadata || '{"runtime_table":"sentinel_scenes","training_source":"sentinel-1-sar-training"}'::jsonb
WHERE slug = 'sentinel-1-sar';
