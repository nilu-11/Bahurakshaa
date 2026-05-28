# BAHURAKSHAA Benchmark 2

Date: 2026-05-27

## Checkpoint Summary
This checkpoint confirms the pipeline is working end-to-end through Phase 5 and Phase 6 integration is underway:
1. Data collection and verification complete.
2. Preprocessing complete with SAR and soil moisture features.
3. Time-based model training complete (XGBoost selected for both hazards).
4. New FastAPI inference backend implemented and smoke-tested.
5. Frontend contract cleanup started to remove legacy/mock risk paths from active navigation.

## What Was Completed

### 1) Data layer
- Verified datasets:
  - `data/raw/bipad/incidents-1779812950140.csv`
  - `data/raw/rainfall/gpm_bagmati_daily.csv`
  - `data/raw/discharge/glofas_bagmati_daily.csv`
  - `data/raw/sentinel/sentinel1_bagmati_daily.csv`
  - `data/raw/dem/srtm_bagmati.tif`
  - `data/raw/landuse/worldcover_nepal.tif`
- Verification script: `scripts/04_verify_downloads.py`

### 2) Feature engineering and training data
- Script: `scripts/05_preprocess.py`
- Flood table: `data/training/flood_training.csv`
  - 397 rows, 97 positive, 300 negative
- Landslide table: `data/training/landslide_training.csv`
  - 593 rows, 193 positive, 400 negative
- Included flood features now include:
  - Rainfall windows (`rf_1day`, `rf_3day`, `rf_7day`, `rf_30day`)
  - `discharge_proxy`
  - `soil_moisture_index`
  - Terrain (`elevation_m`, `slope_deg`, `aspect_deg`, `curvature`)
  - SAR (`sar_vv_db`, `sar_vh_db`, `sar_vv_vh_ratio_db`)

### 3) Model training checkpoint
- Script: `scripts/06_train_models.py`
- Split strategy: time-based
  - train: `<= 2022`
  - val: `2023-2024`
  - test: `>= 2025`
- Selected model: XGBoost for both tasks
- Artifacts:
  - `models/flood_model.pkl`
  - `models/landslide_model.pkl`
  - `models/flood_model_metrics.json`
  - `models/landslide_model_metrics.json`
  - `models/TRAINING_METHOD_REPORT.md`

#### Latest metrics snapshot (hardened negatives + tuned XGBoost)
- Flood:
  - Validation ROC-AUC `0.9962`, PR-AUC `0.9930`
  - Test ROC-AUC `0.9940`, PR-AUC `0.9891`, F1 `0.9412`, Accuracy `0.9574`
  - Threshold `0.300000`
- Landslide:
  - Validation ROC-AUC `0.9986`, PR-AUC `0.9983`
  - Test ROC-AUC `0.9875`, PR-AUC `0.9821`, F1 `0.9412`, Accuracy `0.9592`
  - Threshold `0.430000`

### 4) Phase 5 API completed (local service)
- Files:
  - `api/main.py`
  - `api/README.md`
- Endpoints implemented:
  - `GET /health`
  - `POST /predict/flood`
  - `POST /predict/landslide`
  - `GET /risk/zones`
  - `POST /ingest/satellite`
- Smoke test status: passed (health + both prediction routes + risk scoring + ingest)
- Stability fix added: automatic derivation of `month`, `day_of_year`, and `sar_vv_vh_ratio_db` now works even when those fields are sent as `null`.
- Composite formula implemented:
  - `0.40*flood_prob + 0.40*landslide_prob + 0.20*rainfall_score`

### 5) Phase 6 bootstrap started (frontend adapter)
- Added new client wrapper:
  - `frontend/src/lib/hazard-api.ts`
- Added environment setting:
  - `frontend/.env.example` includes `VITE_HAZARD_API_BASE`
- Purpose:
  - Allows wiring existing React UI to the new root ML API without immediately replacing legacy client code.

### 6) Frontend contract cleanup (active app)
- Removed mock-only navigation routes from active sidebar/router:
  - `/glof`
  - `/landslides`
- Removed dashboard dependency on legacy Render classifier history endpoint.
- Updated river monitoring labels and source handling to distinguish:
  - persisted observation series
  - fallback synthetic projections
- Added model-driven in-app warning flow:
  - Dashboard and Alerts now merge hazard-model, rainfall, station, and routing-based warning signals.
  - Prototype avoids fragile manual write actions when Supabase write policies are restricted.

## Professional Readout

### Strengths at this checkpoint
1. End-to-end automation from raw data to trained models is working.
2. The model decision rule and threshold formula are documented.
3. API is now ready for frontend integration and live scoring.

### Suggested Final-Year Report Claim (Conservative and Strong)
- "The Bahurakshaa prototype successfully implements an end-to-end hazard intelligence pipeline for Bagmati Basin, including multi-source data ingestion, feature engineering, time-based XGBoost training, and FastAPI deployment for flood and landslide inference. Benchmark runs achieved high validation and test discrimination performance, demonstrating technical feasibility for ML-backed early warning support."

### Remaining gaps before production-grade claims
1. Spatial filtering is still BBOX-based, not true basin polygon masking.
2. Soil type and real NDVI time-series are not integrated yet.
3. Near-perfect validation metrics indicate potential optimism risk and need stricter external validation.

## Next Work Package (Phase 6 start)
1. Complete scheduled persistence of `/risk/zones/live` outputs into `risk_zone_assessments`.
2. Replace remaining synthetic river series with observed gauge ingestion.
3. Add calibration curve and threshold sensitivity report for model governance.
4. Add authenticated notification dispatch (SMS/push/email) from alert policies.
