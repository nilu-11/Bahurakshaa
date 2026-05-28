# BAHURAKSHAA Data Benchmark

Date: 2026-05-26
Project: Bagmati Basin flood/landslide early warning

## 1. Collected Datasets (Current)

| Dataset | Source | File(s) | Coverage | Status |
|---|---|---|---|---|
| BIPAD incidents | BIPAD portal (manual CSV) | `data/raw/bipad/incidents-1779812950140.csv` | 2015-06-14 to 2025-11-15 | Collected |
| Rainfall (GPM) | Google Earth Engine (`NASA/GPM_L3/IMERG_V07`) | `data/raw/rainfall/gpm_bagmati_daily.csv` | 2015-05-01 to 2025-10-31 (monsoon months) | Collected |
| Discharge proxy | Google Earth Engine (`ECMWF/ERA5_LAND/DAILY_AGGR`) | `data/raw/discharge/glofas_bagmati_daily.csv` | 2015-05-01 to 2025-10-31 (monsoon months) | Collected |
| DEM | SRTM | `data/raw/dem/srtm_bagmati.tif` | Static raster | Collected |
| Landcover | ESA WorldCover v200 | `data/raw/landuse/worldcover_nepal.tif` | Static raster | Collected |

## 2. Stations Used for Hydro Features

Defined in `config.py` and used in discharge export:

| Station ID | Name | Lat | Lon | River km | Warning (m) | Danger (m) |
|---|---|---:|---:|---:|---:|---:|
| st-2 | Sundarijal | 27.7700 | 85.4200 | 20.4 | 3.8 | 4.5 |
| st-3 | Gokarna | 27.7300 | 85.3700 | 15.8 | 4.8 | 5.5 |
| st-5 | Pashupati | 27.7100 | 85.3500 | 10.9 | 4.8 | 5.5 |
| st-4 | Teku | 27.6950 | 85.3050 | 5.4 | 4.8 | 5.5 |
| st-1 | Chovar | 27.6600 | 85.2900 | 0.8 | 4.8 | 5.5 |

Observed in `glofas_bagmati_daily.csv`:
- `station_id`: `st-1, st-2, st-3, st-4, st-5`
- `station_name`: `Chovar, Gokarna, Pashupati, Sundarijal, Teku`

## 3. Parameters Collected

### 3.1 Rainfall file (`gpm_bagmati_daily.csv`)
Columns:
- `date`
- `rainfall_mm`
- `system:index`, `.geo` (GEE metadata)

Derived in preprocessing:
- `rf_1day`, `rf_3day`, `rf_7day`, `rf_30day`

### 3.2 Discharge proxy file (`glofas_bagmati_daily.csv`)
Columns:
- `date`
- `station_id`, `station_name`
- `surface_runoff_sum`
- `sub_surface_runoff_sum`
- `total_precipitation_sum`
- `system:index`, `.geo` (GEE metadata)

Derived in preprocessing:
- `discharge_proxy` (area-scaled runoff proxy)

### 3.3 Terrain/Landcover
From `srtm_bagmati.tif`:
- `elevation_m`, `slope_deg`, `aspect_deg`, `curvature`

From `worldcover_nepal.tif`:
- `landuse_code`, `landuse_class`, `ndvi_proxy`

### 3.4 Label data (BIPAD)
Hazards currently available in current raw BIPAD file:
- `flood`
- `landslide`

Counts in `incidents-1779812950140.csv`:
- `flood`: 376
- `landslide`: 1015

Counts used after preprocessing filters (monsoon months + Bagmati district/geocoding):
- `flood`: 276
- `landslide`: 732

## 4. Training Table Snapshot (Current)

Generated files:
- `data/training/flood_training.csv`: 397 rows, 97 positive, 300 negative
- `data/training/landslide_training.csv`: 593 rows, 193 positive, 400 negative

Current strengths:
- No core feature nulls in generated training tables.
- Rainfall and discharge date coverage aligned through 2025-10-31.
- Time-based split compatibility confirmed for train/val/test:
  - train: <= 2022
  - val: 2023-2024
  - test: >= 2025

Current risks:
- Metrics remain likely optimistic due to synthetic negative sampling strategy and coarse spatial labeling.
- Some event points can still fall outside current configured bbox due to municipality geocoding and basin extent mismatch.
- Event geolocation remains municipality-level for many rows, so spatial precision is limited.

## 4.1 Result Snapshot (Report-Friendly)

Latest training/evaluation artifacts:
- `models/flood_model_metrics.json`
- `models/landslide_model_metrics.json`

Latest headline metrics:
- Flood (XGBoost selected):
  - Validation ROC-AUC: 0.9797
  - Test ROC-AUC: 0.9982
  - Test F1: 0.9778
- Landslide (XGBoost selected):
  - Validation ROC-AUC: 1.0000
  - Test ROC-AUC: 1.0000
  - Test F1: 0.9778

Report note:
- These results demonstrate strong prototype performance and successful end-to-end integration from data ingestion to inference API.
- For deployment-grade claims, stricter external validation and spatial QA are still required.

## 5. What Is Required Before Robust Model Training

### High-priority requirements
1. Expand/refine event quality (history is now multi-year):
- Keep adding future seasons, but prioritize cleaning duplicates and improving coordinate precision.

2. Spatial consistency:
- Replace simple bbox handling with basin polygon clipping and event-in-basin validation.

3. Label quality:
- Deduplicate repeated event rows (`date`, `lat`, `lon`, `hazard`).
- Validate municipality geocoding against authoritative admin boundaries.

4. Train/validation protocol:
- Use time-based split (not random split) to avoid leakage.
- Keep final test season fully out-of-time.

### Recommended feature enhancements
5. Hydrometeorological features:
- Antecedent runoff windows (3/7/15 day) at station and basin aggregate levels.
- Extreme rainfall indices (P95/P99 exceedance, event duration).

6. Terrain/hydrology features:
- Flow accumulation, TWI, distance-to-river from DEM-derived drainage network.

7. Exposure/vulnerability context:
- Population, road density, built-up density, land-use change where available.

## 6. Readiness Verdict

- Pipeline status: Functional.
- Data completeness status: Sufficient for prototype experiments.
- Production-readiness status: Not yet; requires larger label history and stricter spatial/temporal QA.
