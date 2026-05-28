
What your trained models are predicting
You trained 2 binary classifiers:

Flood model
Predicts probability of flood event (0..1) for a zone-date feature set.
Landslide model
Predicts probability of landslide event (0..1) for a zone-date feature set.
These are combined in backend:

composite = 0.40*flood_prob + 0.40*landslide_prob + 0.20*rainfall_score
Risk level:
safe < 0.32
watch 0.32–0.58
warning 0.58–0.78
evacuate >= 0.78
Exactly what UI shows and where it comes from
Dashboard
Model Status card
Source: GET /risk/zones/live and GET /health.
Shows Active if model-backed live zone risk is returned.
Shows Fallback when API fails/unreachable.
Prediction card
Source: top zone from /risk/zones/live.
Displays highest composite-risk zone.
Active Alerts
Source: merged
DB alerts (alerts table)
model-generated alerts (from live risk + stations + rainfall + routing logic)
Stations, Sensors, Citizen Reports
Source: Supabase tables (river_stations, data_sources.metadata, citizen_reports).
River Level — TekuWhat your trained models are predicting
You trained 2 binary classifiers:

Flood model
Predicts probability of flood event (0..1) for a zone-date feature set.
Landslide model
Predicts probability of landslide event (0..1) for a zone-date feature set.
These are combined in backend:

composite = 0.40*flood_prob + 0.40*landslide_prob + 0.20*rainfall_score
Risk level:
safe < 0.32
watch 0.32–0.58
warning 0.58–0.78
evacuate >= 0.78
Exactly what UI shows and where it comes from
Dashboard
Model Status card
Source: GET /risk/zones/live and GET /health.
Shows Active if model-backed live zone risk is returned.
Shows Fallback when API fails/unreachable.
Prediction card
Source: top zone from /risk/zones/live.
Displays highest composite-risk zone.
Active Alerts
Source: merged
DB alerts (alerts table)
model-generated alerts (from live risk + stations + rainfall + routing logic)
Stations, Sensors, Citizen Reports
Source: Supabase tables (river_stations, data_sources.metadata, citizen_reports).
River Level — Teku
Source priority:
DB river_level_observations
fallback synthetic projection if DB series missing.
Why zones are risky
Source:
live model zones (/risk/zones/live) if available
fallback risk engine otherwise.
Risk Map
Zone heat overlays
Source:
/risk/zones/live (primary)
fallback risk_zones + local composite logic.
Station markers
Source: river_stations.
Citizen report markers
Source: citizen_reports.
Satellite footprints
Source: satellite_products.
If map is empty, either:

no zone rows from API and no fallback zone rows in DB, or
fetch failed.
River Monitoring
Station cards
Source: river_stations.
River level chart
Source: river_level_observations (else fallback projection).
HEC-RAS-ready panel
Source: local hydraulic simulation logic (hecrasModel.ts) with rainfall context.
This is simulation support, not calibrated operational HEC-RAS yet.
Alerts page
Alert list
Source: merged model + DB alerts.
Browser notifications
Trigger for new warning/evacuate alerts if permission granted.
If everything is zero, upstream model/DB feeds are not returning actionable values.

Is it “live real-time” right now?
Professional answer: partially live, not fully real-time streaming yet.

Model side:
/risk/zones/live uses latest available local datasets (data/raw/...) at request time.
It is “live scoring on latest ingested data,” not continuous sensor stream inference.
Supabase side:
Live only if your ingestion jobs keep tables updated (rainfall_forecasts, river_level_observations, etc.).
If tables are seed/empty/stale, UI is also stale/zero.
So the system can do near-real-time operational updates, but only when data ingestion is actively running.


Source priority:
DB river_level_observations
fallback synthetic projection if DB series missing.
Why zones are risky
Source:
live model zones (/risk/zones/live) if available
fallback risk engine otherwise.
Risk Map
Zone heat overlays
Source:
/risk/zones/live (primary)
fallback risk_zones + local composite logic.
Station markers
Source: river_stations.
Citizen report markers
Source: citizen_reports.
Satellite footprints
Source: satellite_products.
If map is empty, either:

no zone rows from API and no fallback zone rows in DB, or
fetch failed.
River Monitoring
Station cards
Source: river_stations.
River level chart
Source: river_level_observations (else fallback projection).
HEC-RAS-ready panel
Source: local hydraulic simulation logic (hecrasModel.ts) with rainfall context.
This is simulation support, not calibrated operational HEC-RAS yet.
Alerts page
Alert list
Source: merged model + DB alerts.
Browser notifications
Trigger for new warning/evacuate alerts if permission granted.
If everything is zero, upstream model/DB feeds are not returning actionable values.

Is it “live real-time” right now?
Professional answer: partially live, not fully real-time streaming yet.

Model side:
/risk/zones/live uses latest available local datasets (data/raw/...) at request time.
It is “live scoring on latest ingested data,” not continuous sensor stream inference.
Supabase side:
Live only if your ingestion jobs keep tables updated (rainfall_forecasts, river_level_observations, etc.).
If tables are seed/empty/stale, UI is also stale/zero.
So the system can do near-real-time operational updates, but only when data ingestion is actively running.

