import { supabase } from "@/integrations/supabase/client";
import type { CompositeRiskZone } from "@/lib/riskEngine";

export type PersistRiskAssessmentResult = {
  attempted: number;
  inserted: number;
  error?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function persistRiskAssessments(
  zones: CompositeRiskZone[],
): Promise<PersistRiskAssessmentResult> {
  if (!zones.length) return { attempted: 0, inserted: 0 };

  const rows = zones.map((zone) => ({
    zone_id: UUID_RE.test(zone.id) ? zone.id : null,
    zone_name: zone.name,
    computed_risk_level: zone.computedRiskLevel,
    composite_score: zone.compositeScore,
    computed_flood_probability: zone.computedFloodProb,
    data_quality: zone.dataQuality,
    nearest_station_name: zone.nearestStationName ?? null,
    drivers: zone.drivers,
    explanation: { bullets: zone.explanation },
    model_versions: {
      risk_engine: "frontend-v1",
      hecras: "bagmati-scaffold-v1",
      rainfall: "open-meteo-or-local-seasonal-v1",
      xgboost: "root-hazard-api-v1",
    },
    source: "frontend-risk-engine",
  }));

  const { error } = await supabase.from("risk_zone_assessments" as never).insert(rows as never);

  if (error) {
    return { attempted: rows.length, inserted: 0, error: error.message };
  }

  return { attempted: rows.length, inserted: rows.length };
}
