import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Brain, CheckCircle2, Satellite } from "lucide-react";
import { getHazardHealth, getLiveZoneRisks } from "@/lib/hazard-api";
import { cn } from "@/lib/utils";
import { REQUIRE_LIVE_DATA } from "@/lib/dataMode";

export default function ModelStatusPanel() {
  const health = useQuery({
    queryKey: ["hazard-api-health"],
    queryFn: getHazardHealth,
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });

  const latest = useQuery({
    queryKey: ["hazard-live-zone-risks"],
    queryFn: () => getLiveZoneRisks(),
    retry: 1,
    staleTime: 1000 * 60 * 10,
  });

  const topZone = latest.data?.zones?.[0];
  const hasRealData = Boolean(latest.data?.zones?.length);
  const isHealthy = hasRealData || (health.data?.status === "ok" && !health.error);

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card to-secondary/20 p-5 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-400/15">
            <Brain className="h-4 w-4 text-ocean-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Flood + Landslide ML Models</h3>
            <p className="text-xs text-muted-foreground">
              Root hazard API with zone-level composite risk scoring
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
            isHealthy ? "bg-risk-safe/10 text-risk-safe" : "bg-risk-warning/10 text-risk-warning",
          )}
        >
          {isHealthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {health.isLoading ? "Checking" : isHealthy ? "Online" : "Unavailable"}
        </span>
      </div>

      {topZone ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Top Zone" value={topZone.zone_name} />
          <Metric label="Risk" value={`${(topZone.composite_score * 100).toFixed(0)}%`} />
          <Metric label="Level" value={topZone.risk_level.toUpperCase()} />
          <Metric label="Horizon" value="24–48h" />
        </div>
      ) : (
        <div className="rounded-lg border border-risk-warning/30 bg-risk-warning/10 p-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Satellite className="h-4 w-4 flex-shrink-0 text-risk-warning" />
            <span>
              {latest.isLoading
                ? "Loading live zone risk prediction..."
                : REQUIRE_LIVE_DATA
                  ? "Live-only mode is enabled. No model prediction is available yet."
                  : "No live model prediction is available. The composite risk engine will continue using rainfall, gauge, HEC-RAS, and stored zone values."}
            </span>
          </div>
        </div>
      )}

      {(health.error || latest.error) && !hasRealData && (
        <p className="mt-3 text-[11px] text-risk-warning">
          API note: root hazard API did not respond successfully. Check local service status,
          dataset availability, and Python dependencies.
        </p>
      )}

      {latest.data?.model_versions && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Versions: flood `{latest.data.model_versions.flood_model ?? "n/a"}` • landslide
          `{latest.data.model_versions.landslide_model ?? "n/a"}`
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/20 p-3">
      <div className="truncate text-sm font-semibold capitalize text-foreground">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
