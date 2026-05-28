# Bahurakshaa Prototype User Manual

## 1) What this web app does
Bahurakshaa provides zone-level flood/landslide early-warning support for Bagmati Basin by combining:
- trained ML hazard probabilities from the backend API
- operational data from Supabase
- hydraulic simulation context from a HEC-RAS-ready digital twin layer

Main output to users: **24–48h preparedness guidance**, not deterministic minute-level flood certainty.

## 2) Login and navigation flow
1. Open app and sign in.
2. After login, you enter **Dashboard**.
3. Sidebar navigation:
- Dashboard
- Risk Map
- River Monitoring
- Alerts
- Citizen Reports
- Data Sources
- About

## 3) Feature-by-feature usage

### Dashboard
What user sees:
- top risk stats
- highest-risk zone
- model status
- active alerts feed
- zone risk table
- risk explanation panel
- rainfall and river level charts

What user can do:
- identify critical zones quickly
- read why a zone is risky
- monitor live/fallback status

### Risk Map
What user sees:
- geospatial zone risk overlay
- station status
- citizen report markers
- satellite footprint overlays

What user can do:
- inspect zone-level risk spatially
- compare flood/landslide indicators across areas

### River Monitoring
What user sees:
- station cards with warning/danger context
- 48h river level history/projection
- digital twin hydraulic panel

What user can do:
- monitor gauge escalation
- interpret simulated routing context (arrival/depth/velocity trends)

### Alerts
What user sees:
- merged alert stream from model logic + database records
- severity levels (`watch`, `warning`, `evacuate`)
- notification channel status

What user can do:
- review active warnings
- enable browser notifications

### Citizen Reports
What user sees:
- community reports list
- verification state and trust metadata

What user can do:
- submit structured field report
- monitor latest community observations

### Data Sources
What user sees:
- source health/status metadata
- sentinel scene recency and details
- ingestion timeline indicators

What user can do:
- verify data freshness
- audit source coverage

## 4) Backend-to-UI data mapping

## A. Root hazard API (`api/main.py`)
Endpoint -> UI usage
- `GET /health`
  - Dashboard model status panel
- `GET /risk/zones/live`
  - Dashboard risk stats/table/explanations
  - Risk Map primary zone overlay
  - Alerts model-driven warning generation
- `POST /predict/flood`, `POST /predict/landslide`
  - available contract for direct scoring integrations (not primary dashboard route)

## B. Supabase operational tables
Table -> UI usage
- `alerts`
  - Alerts page + dashboard alert feed (database layer)
- `risk_zones`
  - fallback zone baseline when API live risk unavailable
- `river_stations`
  - monitoring cards, map station markers
- `river_level_observations`
  - river level chart (preferred source)
- `rainfall_forecasts`
  - rainfall chart + fallback river/risk computations
- `citizen_reports`
  - citizen reports page + map markers
- `data_sources`
  - data source health cards
- `satellite_products`
  - map overlays + data source details
- `sentinel_scenes`
  - latest scene inventory and freshness

## C. HEC-RAS-ready simulation
Source -> UI usage
- `frontend/src/lib/hecrasModel.ts`
  - River Monitoring hydraulic panel
  - model warning enrichment context in alerts
- `hec_ras/bagmati_q10_results_placeholder.csv`
  - contract reference for future calibrated imports

## 5) Alert notifications (current state)
Implemented now:
1. In-app notifications (toast) for new `warning/evacuate` alerts.
2. Browser notifications (when user grants permission).
3. Alerts derived from:
- live model zone risk
- station danger ratio
- routing risk
- rainfall trigger context

Not yet fully deployed:
- server-side SMS/email/push dispatch pipeline.

## 6) How “24–48h early warning” is represented
UI claim is based on preparedness horizon logic from:
- rainfall forecast windows
- antecedent hydro-meteorological features
- model risk scores
- hydraulic routing context

Users should interpret it as:
- a preparedness decision-support horizon
- not exact flood arrival-time certainty

## 7) Removed / de-scoped features
To keep prototype clean and reliable:
1. Removed unused legacy pages not wired into active app flow:
- GLOF page (legacy mock module)
- Landslides standalone page (legacy mock module)
2. Removed legacy external classifier client from active frontend (`bahuraksha-api.ts` path).
3. Removed fragile manual actions that depended on restricted write policies in prototype mode.

## 8) Operator checklist (daily use)
1. Open Dashboard and confirm model status is online.
2. Check top-risk zones and active warning feed.
3. Inspect Risk Map for geographic concentration.
4. Validate station escalation in Monitoring.
5. Review citizen reports for field corroboration.
6. Confirm Data Sources freshness before operational briefing.
