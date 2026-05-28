import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import AlertFeed from "@/components/dashboard/AlertFeed";
import RiskLevelBadge from "@/components/dashboard/RiskLevelBadge";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Info, Radio, Smartphone, type LucideIcon } from "lucide-react";
import { getLiveZoneRisks } from "@/lib/hazard-api";
import { fetchRainfallForecasts, fetchRiverStations } from "@/lib/operationalData";
import { fetchSyntheticRoutingResults } from "@/lib/hecrasModel";
import { buildModelAlerts } from "@/lib/earlyWarning";
import { requestBrowserNotificationPermission } from "@/lib/notifications";

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

const sevOrder: Record<AlertRow["severity"], number> = {
  evacuate: 0,
  warning: 1,
  watch: 2,
  safe: 3,
};

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const { data: liveZoneRisk } = useQuery({
    queryKey: ["hazard-live-zone-risks"],
    queryFn: () => getLiveZoneRisks(),
    retry: 1,
    staleTime: 1000 * 60 * 10,
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

  const {
    data: alerts = [],
    isLoading,
    error,
  } = useQuery<AlertRow[]>({
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

  useEffect(() => {
    const channel = supabase
      .channel("alerts-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["alerts"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
    const dbAlerts = alerts.map((alert) => ({
      ...alert,
      timestamp: alert.created_at ?? new Date().toISOString(),
      source: "database" as const,
    }));
    const map = new Map<string, (typeof dbAlerts)[number] | (typeof modelAlerts)[number]>();
    for (const item of [...modelAlerts, ...dbAlerts]) map.set(item.id, item);
    return Array.from(map.values()).sort((a, b) => {
      const bySeverity = sevOrder[a.severity] - sevOrder[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return b.timestamp.localeCompare(a.timestamp);
    });
  }, [alerts, modelAlerts]);

  const activeCount = mergedAlerts.filter((a) => a.is_active).length;
  const hasCritical = mergedAlerts.some((a) => a.severity === "evacuate" && a.is_active);
  const permission: NotificationPermission =
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied";

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl">Early Warning Center</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              In-app alerts generated from zone models, gauge conditions, hydraulic routing, and live incident records.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bell className="h-4 w-4" />
            <span>{activeCount} active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-border p-5 xl:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">Notification Channels</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <ChannelCard
                icon={Radio}
                title="Dashboard Alerts"
                description="Always on. Severity escalates from watch to evacuate."
                status="active"
              />
              <ChannelCard
                icon={Smartphone}
                title="SMS / Push Bridge"
                description="Prepared for connector-based dispatch from the alert engine."
                status="pilot"
              />
              <ChannelCard
                icon={Info}
                title="Lead-Time Policy"
                description="24–48h preparedness window shown with model confidence and data quality."
                status="active"
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  const result = await requestBrowserNotificationPermission();
                  if (result === "granted") window.location.reload();
                }}
                className="rounded-md border border-ocean-400/40 bg-ocean-400/10 px-3 py-1.5 text-xs font-medium text-ocean-400 hover:bg-ocean-400/20"
              >
                Enable Browser Notifications
              </button>
              <span className="text-xs text-muted-foreground">Status: {permission}</span>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Manual alert creation is disabled in this prototype mode to avoid permission drift.
              Alerts are produced from model/routing logic and stored records.
            </p>
          </div>

          <div className="rounded-xl border border-border p-5">
            <h3 className="mb-3 text-sm font-semibold">Current Posture</h3>
            <div className="space-y-2">
              <Row label="Operational mode" value={hasCritical ? "Escalated" : "Monitoring"} />
              <Row label="Forecast horizon" value="24–48 hours" />
              <Row label="Model data date" value={liveZoneRisk?.data_date ?? "n/a"} />
              <div className="pt-2">
                <RiskLevelBadge level={hasCritical ? "evacuate" : "watch"} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-1">
            {isLoading ? (
              <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                Loading alerts...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-risk-warning/40 bg-risk-warning/10 p-4 text-sm text-risk-warning">
                Could not load database alerts. Showing model-generated alerts only.
              </div>
            ) : null}
            <AlertFeed alerts={mergedAlerts} />
          </div>

          <div className="space-y-3 xl:col-span-2">
            {mergedAlerts.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <RiskLevelBadge level={alert.severity} />
                  <div className="text-xs text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
                <p className="text-base font-semibold text-foreground">{alert.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                    {alert.zone}
                  </span>
                  <span className="rounded-full bg-ocean-400/10 px-2 py-0.5 text-[10px] text-ocean-400">
                    {alert.source === "model" ? "ML Engine" : "Database"}
                  </span>
                </div>
              </div>
            ))}
            {mergedAlerts.length === 0 && (
              <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
                No active early-warning alerts right now.
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function ChannelCard({
  icon: Icon,
  title,
  description,
  status,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  status: "active" | "pilot";
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-ocean-400" />
          <span className="text-xs font-semibold text-foreground">{title}</span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] ${
            status === "active"
              ? "bg-risk-safe/15 text-risk-safe"
              : "bg-risk-watch/15 text-risk-watch"
          }`}
        >
          {status}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
