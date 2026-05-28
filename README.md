# BAHURAKSHAA — End-to-End Workflow and Checkpoints

Flood and landslide early warning pipeline for Bagmati Basin, with ML training, API, frontend, and HEC-RAS scaffold maintained in this root project.

## Repository Layout

- `scripts/` — current ML/data pipeline (`01` to `07`)
- `api/` — Phase 5 FastAPI inference and risk service
- `data/` — raw, processed, and training data
- `models/` — trained model artifacts + metrics
- `frontend/` — active React UI (dashboard, risk map, monitoring, alerts, data sources)
- `hec_ras/` — HEC-RAS scaffold and CSV integration contract
- `supabase/migrations/` — operational data schema and alert/risk-assessment automation SQL

## Phase Checkpoint Benchmark

| Phase | Goal | Current Status | Evidence | Gap / Risk |
|---|---|---|---|---|
| Phase 1: Data collection | GPM, discharge, DEM, BIPAD, WorldCover, Sentinel-1 | Done | `scripts/01..04`, `scripts/07_download_sar.py`, files in `data/raw/` | Data QA is still needed for outliers and date alignment |
| Phase 2: Preprocessing | Clip/reproject/resample, QA labels, build training tables | Done (prototype) | `scripts/05_preprocess.py`, `data/training/*.csv` | Current spatial filtering is BBOX-based, not basin-polygon-based |
| Phase 3: Feature engineering | Flood + landslide features per spec | Mostly done | feature columns in `data/training/` + SAR/SMI integration in `scripts/05_preprocess.py` | Soil type and real NDVI time-series are still pending |
| Phase 4: Model training | Train hazard models and benchmark | Done (hardened prototype) | `scripts/06_train_models.py`, metrics JSON files | Spatial holdout and basin polygon masking are still pending |
| Phase 5: FastAPI backend | Hazard endpoints and scoring service | Done (local service) | `api/main.py`, `api/README.md` | Deployment, auth, and monitoring are still pending |
| Phase 6: Dashboard wiring | Replace mock data with ML outputs | In progress | `frontend/src/lib/hazard-api.ts`, `frontend/src/pages/Index.tsx`, `frontend/src/components/layout/AppSidebar.tsx` | Some operational modules are still heuristic/fallback driven |

## Model Checkpoint (Latest Run)

Source files:
- `models/flood_model_metrics.json`
- `models/landslide_model_metrics.json`

| Model | Split | ROC-AUC | PR-AUC | F1 | Accuracy |
|---|---|---:|---:|---:|---:|
| Flood (XGBoost selected) | Validation | 0.9962 | 0.9930 | 0.9767 | 0.9857 |
| Flood (XGBoost selected) | Test | 0.9940 | 0.9891 | 0.9412 | 0.9574 |
| Landslide (XGBoost selected) | Validation | 0.9986 | 0.9983 | 0.9844 | 0.9859 |
| Landslide (XGBoost selected) | Test | 0.9875 | 0.9821 | 0.9412 | 0.9592 |

Important interpretation:
- These scores remain strong after harder negative sampling.
- Real-world deployment still requires spatial holdout and basin-polygon masking to reduce optimism risk.

## Reused Assets (now in root)

1. Frontend architecture and UX components
- `frontend/src/pages/`, `frontend/src/components/`
- Risk map, station cards, alert feed, dashboard structure are strong.

2. Supabase operational data model and ingestion foundations
- `frontend/src/lib/operationalData.ts`
- Supabase schema/migration references retained in project history and docs.

3. HEC-RAS integration contract
- `hec_ras/README.md`
- `hec_ras/bagmati_q10_results_placeholder.csv`
- `frontend/src/lib/hecrasModel.ts`

## What Must Be Replaced or Refactored

1. Legacy API mismatch
- Archived legacy API artifacts are 3-class satellite classifier logic (`dry_land/flood_water/snow_glacier`), not the active flood/landslide hazard API used by this prototype.

2. Mock and synthetic logic still present
- Standalone GLOF/Landslide pages are now hidden from active navigation, but source files still exist.
- `operationalData.ts` still uses explicit fallback generation when no persisted observations exist.

3. Heuristic risk scoring should become model-backed service output
- Current frontend `riskEngine.ts` uses weighted composite logic.
- Keep as fallback/explainability layer, but primary risk should come from backend-scored zones.

## Best Workflow Going Forward

### Step 1: Lock data and modeling contract
1. Freeze a dataset snapshot tag for training files and metrics.
2. Define final feature schema per model (flood vs landslide).
3. Record model threshold policy and evaluation protocol in versioned docs.

### Step 2: Complete remaining Phase 3 features
1. Add soil type layer and join logic.
2. Replace NDVI proxy with real NDVI time-series where feasible.
3. Add an explicit feature-quality flag column per row for missing proxies.

### Step 3: Spatial quality hardening
1. Move from rectangular BBOX filtering to Bagmati basin polygon masking.
2. Validate event points against admin boundaries and basin footprint.
3. Add automatic duplicate and out-of-basin rejection reports.

### Step 4: Backend hardening and deployment
Implemented endpoints in root `api/`:
1. `POST /predict/flood`
2. `POST /predict/landslide`
3. `GET /risk/zones`
4. `POST /ingest/satellite`

Next hardening tasks:
1. Add model version string in response payload and metrics linkage.
2. Add auth/rate limiting if exposed beyond localhost.
3. Add request logging and failure analytics.

### Step 5: Product integration (UI)
1. Keep current `frontend/` React UI shell and map components.
2. Replace mock data providers with real API + Supabase-backed fetches.
3. Keep fallback mode explicit in UI labels when live model data is unavailable.

### Step 6: Evaluation and reporting gates
Before production demo, require all gates:
1. Time-based holdout metrics from latest season.
2. Error analysis by district and rainfall regime.
3. Calibration curve and threshold sensitivity.
4. Provenance report of all input datasets and update timestamps.

## LSTM and HEC-RAS Positioning

- LSTM: optional, only after stable multi-year gauge time-series is available.
- HEC-RAS: useful as physics-informed signal and scenario engine; keep as a parallel module and integrate via the existing CSV contract, not as a blocker for current MVP.

## Quick Runbook (Current Root Pipeline)

```bash
python scripts/04_verify_downloads.py
GEE_PROJECT=<your-project-id> python scripts/07_download_sar.py
# copy Drive export to: data/raw/sentinel/sentinel1_bagmati_daily.csv
python scripts/05_preprocess.py
python scripts/06_train_models.py
uvicorn api.main:app --reload --port 8000
```

Artifacts:
- `data/training/flood_training.csv`
- `data/training/landslide_training.csv`
- `models/flood_model.pkl`
- `models/landslide_model.pkl`
- `models/flood_model_metrics.json`
- `models/landslide_model_metrics.json`
