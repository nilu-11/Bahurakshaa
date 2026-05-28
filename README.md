# Bahurakshaa

Bahurakshaa is a flood and landslide early-warning prototype for Nepal's Bagmati Basin. It combines a FastAPI model service, a React dashboard, Supabase-backed operational data, and HEC-RAS integration scaffolding for monitoring hazard risk across zones.

## Features

- Flood and landslide risk prediction using trained ML model artifacts.
- Zone-level composite risk scoring from flood probability, landslide probability, and rainfall intensity.
- React dashboard with risk map, monitoring panels, alert feed, citizen reports, and data source status.
- Supabase authentication, role-based access control, and operational data tables.
- HEC-RAS CSV integration scaffold for future hydraulic model outputs.

## Project Structure

```text
api/                    FastAPI inference and risk service
frontend/               Vite + React dashboard
supabase/migrations/    Database schema, RBAC, and policy migrations
scripts/                Data collection, preprocessing, and model training scripts
models/                 Trained model artifacts and metrics
hec_ras/                HEC-RAS documentation and placeholder output contract
docs/                   Project walkthrough and user-facing notes
```

Large local datasets live under `data/` and are intentionally ignored by Git.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Supabase JS
- Backend: FastAPI, Pydantic, pandas, scikit-learn/XGBoost model bundles
- Database/Auth: Supabase
- Deployment target: Vercel for frontend, Render for backend

## Local Setup

### Backend

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

API docs are available at:

```text
http://127.0.0.1:8000/docs
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend URL:

```text
http://localhost:8080
```

Required frontend environment variables:

```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-key"
VITE_HAZARD_API_BASE="http://127.0.0.1:8000"
VITE_REQUIRE_LIVE_DATA="false"
```

## Supabase Roles

Roles are stored in `public.profiles.role`.

Valid role values:

- `admin` - full access
- `ops` - operational access
- `analyst` - monitoring, alerts, and data views
- `field` - field reporting and monitoring access
- `viewer` - dashboard and map access

To promote a user to admin:

```sql
UPDATE public.profiles p
SET role = 'admin',
    updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = lower('your-email@example.com');
```

If the profile row is missing:

```sql
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE lower(email) = lower('your-email@example.com')
ON CONFLICT (id)
DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  updated_at = now();
```

## Backend Endpoints

- `GET /health`
- `POST /predict/flood`
- `POST /predict/landslide`
- `GET /risk/zones`
- `GET /risk/zones/live`
- `POST /ingest/satellite`

## Deployment

### Render Backend

Create a new Render Web Service from the GitHub repo.

Recommended settings:

```text
Root Directory: leave blank
Build Command: pip install -r requirements.txt
Start Command: uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

After the frontend is deployed, set this Render environment variable:

```text
FRONTEND_ORIGINS=https://your-vercel-app.vercel.app
```

### Vercel Frontend

Create a new Vercel project from the GitHub repo.

Recommended settings:

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

Set these Vercel environment variables:

```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-key"
VITE_HAZARD_API_BASE="https://your-render-api.onrender.com"
VITE_REQUIRE_LIVE_DATA="false"
```

## Data and Model Notes

The backend expects trained model artifacts in `models/`:

- `models/flood_model.pkl`
- `models/landslide_model.pkl`

The live zone risk endpoint also uses processed daily CSVs when available:

- `data/raw/rainfall/gpm_bagmati_daily.csv`
- `data/raw/discharge/glofas_bagmati_daily.csv`
- `data/raw/sentinel/sentinel1_bagmati_daily.csv`

Raw local data is large and should not be committed. Commit only the small deployment artifacts that are required by the hosted API.

## Useful Commands

```bash
# Frontend build
cd frontend
npm run build

# Backend smoke test
uvicorn api.main:app --reload --port 8000

# Model/data pipeline
python scripts/05_preprocess.py
python scripts/06_train_models.py
```

## Project Status

Bahurakshaa is an MVP/prototype. It is suitable for demos, architecture review, and continued research development. Before production use, the system needs stronger data QA, spatial holdout validation, deployment hardening, observability, and operational review.
