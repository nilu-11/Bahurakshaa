import type { LiveRainfallForecast, LiveRiverStation } from "@/lib/operationalData";
import type { LiveZoneRiskResponse } from "@/lib/hazard-api";
import type { HecRasStationResult } from "@/lib/hecrasModel";

export type EarlyWarningAlert = {
  id: string;
  type: "flood" | "landslide" | "glof";
  severity: "safe" | "watch" | "warning" | "evacuate";
  title: string;
  message: string;
  zone: string;
  timestamp: string;
  is_active: boolean;
  source: "model" | "database";
};

function percentileLabel(conf: number): string {
  if (conf >= 0.8) return "high";
  if (conf >= 0.55) return "moderate";
  return "low";
}

export function buildModelAlerts(params: {
  liveRisk?: LiveZoneRiskResponse;
  stations?: LiveRiverStation[];
  rainfall?: LiveRainfallForecast[];
  routing?: HecRasStationResult[];
}): EarlyWarningAlert[] {
  const nowIso = new Date().toISOString();
  const out: EarlyWarningAlert[] = [];
  const liveZones = params.liveRisk?.zones ?? [];

  for (const z of liveZones) {
    if (z.risk_level === "safe" || z.risk_level === "watch") continue;
    const conf = Math.max(z.flood_probability, z.landslide_probability);
    const levelText = percentileLabel(conf);
    out.push({
      id: `model-zone-${z.zone_id}-${z.risk_level}`,
      type: z.landslide_probability > z.flood_probability ? "landslide" : "flood",
      severity: z.risk_level,
      title:
        z.risk_level === "evacuate"
          ? `Critical warning — ${z.zone_name}`
          : `Early warning — ${z.zone_name}`,
      message: `Next 24–48h composite risk is ${Math.round(z.composite_score * 100)}% with ${levelText} confidence from model outputs and rainfall conditions.`,
      zone: z.zone_name,
      timestamp: nowIso,
      is_active: true,
      source: "model",
    });
  }

  const stations = params.stations ?? [];
  for (const s of stations) {
    const ratio = s.dangerLevel > 0 ? s.currentLevel / s.dangerLevel : 0;
    if (ratio < 0.9) continue;
    const sev: EarlyWarningAlert["severity"] = ratio >= 1 ? "evacuate" : "warning";
    out.push({
      id: `model-station-${s.id}-${sev}`,
      type: "flood",
      severity: sev,
      title: `${s.name} gauge escalation`,
      message: `Gauge is at ${Math.round(ratio * 100)}% of danger level. Field teams should validate drainage and prepare zone-level response.`,
      zone: s.name,
      timestamp: s.lastUpdated ?? nowIso,
      is_active: true,
      source: "model",
    });
  }

  const routing = params.routing ?? [];
  for (const r of routing) {
    if (r.riskLevel !== "warning" && r.riskLevel !== "evacuate") continue;
    out.push({
      id: `model-routing-${r.stationId}-${r.riskLevel}`,
      type: "flood",
      severity: r.riskLevel,
      title: `Hydraulic scenario — ${r.stationName}`,
      message: `HEC-RAS-ready routing projects elevated flow in ~${r.arrivalTimeHours.toFixed(1)}h for the current scenario window.`,
      zone: r.stationName,
      timestamp: nowIso,
      is_active: true,
      source: "model",
    });
  }

  const rainfall = params.rainfall ?? [];
  const peak = rainfall.reduce<LiveRainfallForecast | null>((max, item) => {
    if (!max || item.rainfall > max.rainfall) return item;
    return max;
  }, null);
  if (peak && peak.rainfall >= 50) {
    const sev: EarlyWarningAlert["severity"] = peak.rainfall >= 90 ? "warning" : "watch";
    out.push({
      id: `model-rainfall-${peak.forecastDate ?? peak.day}-${sev}`,
      type: "flood",
      severity: sev,
      title: "Rainfall trigger outlook",
      message: `Peak forecast is ${peak.rainfall.toFixed(1)}mm (${Math.round(
        peak.probability * 100,
      )}% probability), contributing to 24–48h flood watch conditions.`,
      zone: "Bagmati Basin",
      timestamp: nowIso,
      is_active: true,
      source: "model",
    });
  }

  const dedup = new Map<string, EarlyWarningAlert>();
  for (const a of out) {
    dedup.set(a.id, a);
  }
  return Array.from(dedup.values());
}
