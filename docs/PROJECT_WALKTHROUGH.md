# Bahurakshaa Walkthrough (Simple)

This document explains the whole project in simple words, from start to finish, so you can explain it in a final-year defense.

## 1) One-Page Summary

Bahurakshaa is a flood + landslide early warning system for the Bagmati Basin. It has:
- Data collection scripts
- ML models trained from that data
- A FastAPI backend that serves predictions
- A React dashboard that shows risks, alerts, and live data
- Supabase for operational data (alerts, stations, reports, forecasts)

If live data is not available, the UI can show fallback data (synthetic). If live-only mode is enabled, the UI will show empty states instead.

## 2) The Full Flow (From Start to End)

1. Collect raw data
   - Rainfall (GPM), discharge (GloFAS), DEM, land use, events, SAR (Sentinel-1).
2. Preprocess data
   - Clean, align, and build training tables.
3. Train models
   - Flood and landslide models are trained and saved.
4. Run the backend
   - FastAPI loads models + daily CSVs and returns predictions.
5. Run the frontend
   - React UI calls the API + Supabase and shows results.
6. Operations
   - Alerts and observations are stored in Supabase and shown live.

## 3) What Each Folder Does

- scripts/ — pipeline: download, preprocess, train
- api/ — FastAPI inference server
- data/ — raw + processed + training datasets
- models/ — trained model artifacts + metrics
- frontend/ — React UI and components
- supabase/ — SQL migrations, RLS policies, data tables
- hec_ras/ — placeholder contract for future HEC-RAS integration

## 4) Scripts (What They Do)

- scripts/01..04: download and verify raw datasets
- scripts/05_preprocess.py: build the training CSVs
- scripts/06_train_models.py: train ML models and save them
- scripts/07_download_sar.py: download Sentinel-1 SAR data

Outputs you can mention:
- data/training/flood_training.csv
- data/training/landslide_training.csv
- models/flood_model.pkl
- models/landslide_model.pkl
- models/flood_model_metrics.json
- models/landslide_model_metrics.json

## 5) Backend (FastAPI)

The API loads the trained models and calculates risk:
- /health — check status
- /predict/flood — flood model prediction
- /predict/landslide — landslide model prediction
- /risk/zones — composite risk formula
- /risk/zones/live — live zone scoring from daily data

The composite score is:
- 0.40 * flood + 0.40 * landslide + 0.20 * rainfall

## 6) Supabase (Operational Data)

These tables feed the UI:
- alerts
- river_stations
- river_level_observations
- rainfall_forecasts
- risk_zones
- citizen_reports
- data_sources
- satellite_products

The frontend reads these tables directly.

## 7) UI Tabs (What Each Page Means)

Dashboard
- Summary tiles (alerts, stations, sensors, reports)
- River level chart (Teku station)
- Zone risk table (ranked zones + flood/landslide %)
- Rainfall forecast chart
- Model status (live or fallback)

Risk Map
- Map with zone risk bubbles
- River stations, citizen reports, satellite footprints

River Monitoring
- Live station cards
- Trend arrows and thresholds
- Digital twin visualization
- HEC-RAS panel (synthetic mock data)

Alerts
- Shows alert feed
- Mixes database alerts + model-derived alerts

Citizen Reports
- Community reports, verification status, trust score

Data Sources
- Status of upstream data feeds

About
- Project summary

## 8) Roles and Access (RBAC)

Roles are stored in profiles.role and used in routing + Supabase policies.

- admin: full access
- ops: dashboard, risk map, monitoring, alerts, citizen reports, data sources, about
- analyst: dashboard, risk map, monitoring, alerts, data sources, about
- field: dashboard, risk map, monitoring, citizen reports, about
- viewer: dashboard, risk map, about

## 9) Live vs Fallback Data

Two modes:
- Live + fallback (default): if live feeds are missing, use synthetic values
- Live-only: show empty states when live feeds are missing

Toggle with:
- VITE_REQUIRE_LIVE_DATA=true

## 10) HEC-RAS Status

HEC-RAS is currently a mock layer for demonstration. The panel shows synthetic routing results and is labeled as such. Real integration is planned for a future version.

## 11) Common Defense Q&A (Simple)

Q: How does the UI get real predictions?
A: The UI calls /risk/zones/live from the API, which uses trained models and daily CSVs.

Q: Where do alerts come from?
A: Supabase alerts table + model-generated alerts in the frontend.

Q: What if data is missing?
A: The UI falls back to synthetic data unless live-only mode is enabled.

Q: Is HEC-RAS real?
A: Not yet. It is synthetic for now; real integration is future work.

## 12) Quick Runbook

1) Run preprocessing and training:
- python scripts/05_preprocess.py
- python scripts/06_train_models.py

2) Start backend:
- uvicorn api.main:app --reload --port 8000

3) Start frontend:
- cd frontend
- npm run dev

You can now open the dashboard at http://localhost:8080
