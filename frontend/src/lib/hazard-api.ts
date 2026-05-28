export interface FloodPredictRequest {
  date?: string;
  lat: number;
  lon: number;
  rf_1day: number;
  rf_3day: number;
  rf_7day: number;
  rf_30day: number;
  discharge_proxy: number;
  soil_moisture_index: number;
  elevation_m: number;
  slope_deg: number;
  aspect_deg: number;
  curvature: number;
  sar_vv_db: number;
  sar_vh_db: number;
  sar_vv_vh_ratio_db?: number;
  month?: number;
  day_of_year?: number;
}

export interface LandslidePredictRequest {
  date?: string;
  lat: number;
  lon: number;
  rf_1day: number;
  rf_3day: number;
  rf_7day: number;
  rf_30day: number;
  elevation_m: number;
  slope_deg: number;
  aspect_deg: number;
  curvature: number;
  landuse_code: number;
  ndvi_proxy: number;
  dist_drainage_m: number;
  month?: number;
  day_of_year?: number;
}

export interface PredictResponse {
  model_name: string;
  model_version: string;
  threshold: number;
  probability: number;
  predicted_event: 0 | 1;
  risk_level: "safe" | "watch" | "warning" | "evacuate";
}

export interface CompositeRiskResponse {
  zone: string;
  composite_score: number;
  composite_risk_level: "safe" | "watch" | "warning" | "evacuate";
  formula: string;
  inputs: {
    flood_prob: number;
    landslide_prob: number;
    rainfall_score: number;
  };
}

export interface HealthResponse {
  status: string;
  utc: string;
  flood_model: string;
  landslide_model: string;
}

export interface LiveZoneRiskItem {
  zone_id: string;
  zone_name: string;
  district: string;
  lat: number;
  lon: number;
  population: number;
  flood_probability: number;
  landslide_probability: number;
  rainfall_score: number;
  composite_score: number;
  risk_level: "safe" | "watch" | "warning" | "evacuate";
  flood_predicted_event: 0 | 1;
  landslide_predicted_event: 0 | 1;
  data_quality: string;
}

export interface LiveZoneRiskResponse {
  requested_date: string | null;
  data_date: string;
  generated_at_utc: string;
  source: string;
  formula: string;
  model_versions: Record<string, string>;
  zones: LiveZoneRiskItem[];
}

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_HAZARD_API_BASE) ||
  "http://127.0.0.1:8000";

async function hazardFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Hazard API error ${res.status}`);
  }

  return (await res.json()) as T;
}

export function getHazardHealth(): Promise<HealthResponse> {
  return hazardFetch<HealthResponse>("/health");
}

export function predictFlood(payload: FloodPredictRequest): Promise<PredictResponse> {
  return hazardFetch<PredictResponse>("/predict/flood", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function predictLandslide(payload: LandslidePredictRequest): Promise<PredictResponse> {
  return hazardFetch<PredictResponse>("/predict/landslide", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCompositeRisk(
  floodProb: number,
  landslideProb: number,
  rainfallScore: number,
  zoneName: string = "Bagmati Zone",
): Promise<CompositeRiskResponse> {
  const query = new URLSearchParams({
    flood_prob: String(floodProb),
    landslide_prob: String(landslideProb),
    rainfall_score: String(rainfallScore),
    zone_name: zoneName,
  });
  return hazardFetch<CompositeRiskResponse>(`/risk/zones?${query.toString()}`);
}

export function getLiveZoneRisks(date?: string): Promise<LiveZoneRiskResponse> {
  const query = new URLSearchParams();
  if (date) query.set("date", date);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return hazardFetch<LiveZoneRiskResponse>(`/risk/zones/live${suffix}`);
}
