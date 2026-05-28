import { useEffect, useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Satellite,
  Users,
  Gauge,
  Brain,
  Shield,
  Radio,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/dashboard/StatCard";
import AlertFeed from "@/components/dashboard/AlertFeed";
import RiverLevelChart from "@/components/dashboard/RiverLevelChart";
import ZoneRiskTable from "@/components/dashboard/ZoneRiskTable";
import RainfallChart from "@/components/dashboard/RainfallChart";
import {
  fetchDashboardStats,
  fetchRainfallForecasts,
  fetchRiskZones,
  fetchRiverStations,
} from "@/lib/operationalData";
import ModelStatusPanel from "@/components/dashboard/ModelStatusPanel";
import RiskExplanationPanel from "@/components/dashboard/RiskExplanationPanel";
import {
  computeCompositeRiskZones,
  mapLiveZonesToCompositeZones,
  normalizeRainfallForecasts,
} from "@/lib/riskEngine";
import { getLiveZoneRisks } from "@/lib/hazard-api";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { buildModelAlerts } from "@/lib/earlyWarning";
import { fetchSyntheticRoutingResults } from "@/lib/hecrasModel";
import {
  emitAlertNotifications,
  requestBrowserNotificationPermission,
} from "@/lib/notifications";
import { REQUIRE_LIVE_DATA } from "@/lib/dataMode";

type AlertRow = {
  id: string;
  type: "flood" | "landslide" | "glof";
  severity: "safe" | "watch" | "warning" | "evacuate";
  title: string;
  message: string;
  zone: string;
  created_at?: string;
  is_active: boolean;
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

export default function Index() {
  const queryClient = useQueryClient();

  const { data: liveZoneRisk, isLoading: isPredictionLoading } = useQuery({
    queryKey: ["hazard-live-zone-risks"],
    queryFn: () => getLiveZoneRisks(),
    staleTime: 1000 * 60 * 10, // 10 min
  });

  const { data: alerts = [], isLoading } = useQuery<AlertRow[]>({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
  });
  const { data: zones = [] } = useQuery({
    queryKey: ["risk-zones"],
    queryFn: fetchRiskZones,
  });
  const { data: stations = [] } = useQuery({
    queryKey: ["river-stations"],
    queryFn: fetchRiverStations,
  });
  const { data: rainfallRows = [] } = useQuery({
    queryKey: ["rainfall-forecasts", "Bagmati Basin"],
    queryFn: () => fetchRainfallForecasts("Bagmati Basin"),
  });
  const { data: routingResults = [] } = useQuery({
    queryKey: ["synthetic-routing"],
    queryFn: fetchSyntheticRoutingResults,
  });
  const fallbackComputedZones = computeCompositeRiskZones({
    zones,
    stations,
    rainfall: normalizeRainfallForecasts(rainfallRows),
  });
  const computedZones = mapLiveZonesToCompositeZones(liveZoneRisk);
  const displayZones = computedZones.length
    ? computedZones
    : REQUIRE_LIVE_DATA
      ? []
      : fallbackComputedZones;
  const topZone = displayZones[0];
  const hasLiveModelRisk = computedZones.length > 0;
  const modelAlerts = useMemo(
    () =>
      buildModelAlerts({
        liveRisk: liveZoneRisk,
        stations,
        rainfall: rainfallRows,
        routing: routingResults,
      }),
    [liveZoneRisk, stations, rainfallRows, routingResults],
  );
  const mergedAlerts = useMemo(() => {
    const dbAlerts = alerts.map((a) => ({
      ...a,
      timestamp: a.created_at ?? new Date().toISOString(),
      source: "database" as const,
    }));
    const map = new Map<string, (typeof dbAlerts)[number] | (typeof modelAlerts)[number]>();
    for (const a of [...modelAlerts, ...dbAlerts]) map.set(a.id, a);
    return Array.from(map.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [alerts, modelAlerts]);

  useEffect(() => {
    const channel = supabase
      .channel("alerts-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["alerts"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    const relevant = mergedAlerts
      .filter((a) => a.is_active && (a.severity === "warning" || a.severity === "evacuate"))
      .map((a) => ({
        id: a.id,
        title: a.title,
        body: `${a.zone} • ${a.message}`,
        severity: a.severity,
      }));
    emitAlertNotifications(relevant);
  }, [mergedAlerts]);

  useEffect(() => {
    void requestBrowserNotificationPermission();
  }, []);

  const activeAlerts = mergedAlerts.filter((alert) => alert.is_active).length;
  const hasCriticalAlerts = mergedAlerts.some((a) => a.is_active && a.severity === "evacuate");

  return (
    <AppLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-4 md:p-6 lg:p-8 space-y-6"
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/50"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ocean-400 to-ocean-600 shadow-glow">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Command Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Bagmati Basin • Real-time flood & landslide intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2",
                hasCriticalAlerts
                  ? "border-risk-evacuate/50 bg-risk-evacuate/10"
                  : "border-ocean-400/30 bg-ocean-400/10",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full animate-pulse",
                  hasCriticalAlerts ? "bg-risk-evacuate" : "bg-ocean-400",
                )}
              />
              <Radio className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">
                System {hasCriticalAlerts ? "Alert" : "Online"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          <StatCard
            title="Active Alerts"
            value={isLoading ? "—" : activeAlerts}
            icon={AlertTriangle}
            variant={activeAlerts > 0 ? "danger" : "default"}
            subtitle={`${activeAlerts} active`}
            trend={activeAlerts > 0 ? "up" : "neutral"}
            trendValue={activeAlerts > 0 ? "live" : "none"}
          />
          <StatCard
            title="Stations"
            value={stats?.totalStations ?? "—"}
            icon={Activity}
            variant="primary"
            subtitle="From live database"
            trend="neutral"
          />
          <StatCard
            title="Sensors"
            value={stats?.activeSensors ?? "—"}
            icon={Gauge}
            variant="default"
            subtitle="Reported by live sources"
          />
          <StatCard
            title="Citizen Reports"
            value={stats?.citizenReports ?? "—"}
            icon={Users}
            variant="default"
            subtitle="Current database count"
          />
          <StatCard
            title="Model Status"
            value={hasLiveModelRisk ? "Active" : REQUIRE_LIVE_DATA ? "Unavailable" : "Fallback"}
            icon={Brain}
            variant="success"
            subtitle={
              hasLiveModelRisk
                ? `Live ML date: ${liveZoneRisk?.data_date ?? "n/a"}`
                : REQUIRE_LIVE_DATA
                  ? "Waiting for live model feed"
                  : "Using local composite fallback"
            }
          />
          <StatCard
            title="Prediction"
            value={
              isPredictionLoading
                ? "—"
                : topZone
                  ? `${topZone.name} (${(topZone.compositeScore * 100).toFixed(0)}%)`
                  : "N/A"
            }
            icon={Satellite}
            variant="primary"
            subtitle={
              isPredictionLoading
                ? "Loading..."
                : topZone
                  ? `Risk: ${topZone.computedRiskLevel}`
                  : "No live data"
            }
          />
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-2xl border border-ocean-400/25 bg-ocean-400/5 p-4">
          <p className="text-sm font-medium text-foreground">
            24–48h Early Warning Window
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Lead-time guidance combines rainfall outlook, gauge dynamics, model probability, and HEC-RAS-ready routing signals for preparedness planning.
          </p>
        </motion.div>

        {/* Main content grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <RiverLevelChart />
            <RiskExplanationPanel zones={displayZones} />
            <ZoneRiskTable />
          </div>
          <div className="space-y-6">
            <ModelStatusPanel />
            <AlertFeed
              alerts={mergedAlerts}
            />
            <RainfallChart />
          </div>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
