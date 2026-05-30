import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  Edit3,
  Info,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Search,
  Smartphone,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import AlertFeed from "@/components/dashboard/AlertFeed";
import RiskLevelBadge from "@/components/dashboard/RiskLevelBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getLiveZoneRisks } from "@/lib/hazard-api";
import { fetchRainfallForecasts, fetchRiverStations } from "@/lib/operationalData";
import { fetchSyntheticRoutingResults } from "@/lib/hecrasModel";
import { buildModelAlerts, type EarlyWarningAlert } from "@/lib/earlyWarning";
import { requestBrowserNotificationPermission } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { DEFAULT_ROLE, normalizeRole } from "@/lib/rbac";
import { useAuth } from "@/components/auth/useAuth";

type AlertType = "flood" | "landslide" | "glof";
type Severity = "safe" | "watch" | "warning" | "evacuate";

type AlertRow = {
  id: string;
  type: AlertType;
  severity: Severity;
  title: string;
  message: string;
  zone: string;
  created_at?: string;
  is_active: boolean;
};

type DisplayAlert = (AlertRow | EarlyWarningAlert) & {
  timestamp: string;
  source: "database" | "model";
};

type AlertForm = {
  id?: string;
  type: AlertType;
  severity: Severity;
  title: string;
  message: string;
  zone: string;
  is_active: boolean;
};

const emptyForm: AlertForm = {
  type: "flood",
  severity: "watch",
  title: "",
  message: "",
  zone: "Bagmati Basin",
  is_active: true,
};

const sevOrder: Record<Severity, number> = {
  evacuate: 0,
  warning: 1,
  watch: 2,
  safe: 3,
};

const severityOptions: Array<{ value: Severity; label: string }> = [
  { value: "watch", label: "Watch" },
  { value: "warning", label: "Warning" },
  { value: "evacuate", label: "Evacuate" },
  { value: "safe", label: "Safe" },
];

const typeOptions: Array<{ value: AlertType; label: string }> = [
  { value: "flood", label: "Flood" },
  { value: "landslide", label: "Landslide" },
  { value: "glof", label: "GLOF" },
];

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const resolvedRole = normalizeRole(role ?? DEFAULT_ROLE);
  const canManageAlerts = resolvedRole === "admin" || resolvedRole === "ops";
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AlertForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "resolved">("all");

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

  const saveAlert = useMutation({
    mutationFn: async (payload: AlertForm) => {
      const record = {
        type: payload.type,
        severity: payload.severity,
        title: payload.title.trim(),
        message: payload.message.trim(),
        zone: payload.zone.trim(),
        is_active: payload.is_active,
      };

      if (payload.id) {
        const { error } = await supabase.from("alerts").update(record).eq("id", payload.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("alerts").insert(record);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(form.id ? "Alert updated" : "Alert published");
      setForm(emptyForm);
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (err) => {
      toast.error("Could not save alert", {
        description: err instanceof Error ? err.message : "Check your role and database policy.",
      });
    },
  });

  const toggleAlert = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("alerts").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_, vars) => {
      toast.success(vars.isActive ? "Alert reactivated" : "Alert resolved");
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (err) => {
      toast.error("Could not update alert", {
        description: err instanceof Error ? err.message : "Check your role and database policy.",
      });
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

  const mergedAlerts = useMemo<DisplayAlert[]>(() => {
    const dbAlerts: DisplayAlert[] = alerts.map((alert) => ({
      ...alert,
      timestamp: alert.created_at ?? new Date().toISOString(),
      source: "database",
    }));
    const modelRows: DisplayAlert[] = modelAlerts.map((alert) => ({
      ...alert,
      source: "model",
    }));
    const map = new Map<string, DisplayAlert>();
    for (const item of [...modelRows, ...dbAlerts]) map.set(item.id, item);
    return Array.from(map.values()).sort((a, b) => {
      const bySeverity = sevOrder[a.severity] - sevOrder[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return b.timestamp.localeCompare(a.timestamp);
    });
  }, [alerts, modelAlerts]);

  const filteredAlerts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return mergedAlerts.filter((alert) => {
      if (statusFilter === "active" && !alert.is_active) return false;
      if (statusFilter === "resolved" && alert.is_active) return false;
      if (!needle) return true;
      return [alert.title, alert.message, alert.zone, alert.type, alert.severity]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [mergedAlerts, search, statusFilter]);

  const activeCount = mergedAlerts.filter((a) => a.is_active).length;
  const dbCount = alerts.length;
  const hasCritical = mergedAlerts.some((a) => a.severity === "evacuate" && a.is_active);
  const permission: NotificationPermission =
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied";

  const startCreate = () => {
    setForm(emptyForm);
    setFormOpen(true);
  };

  const startEdit = (alert: DisplayAlert) => {
    if (alert.source !== "database") return;
    setForm({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      zone: alert.zone,
      is_active: alert.is_active,
    });
    setFormOpen(true);
  };

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageAlerts) {
      toast.error("Only admin and operations users can manage alerts");
      return;
    }
    if (!form.title.trim() || !form.message.trim() || !form.zone.trim()) {
      toast.error("Fill title, message, and zone before publishing");
      return;
    }
    saveAlert.mutate(form);
  };

  return (
    <AppLayout>
      <div className="space-y-5 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-risk-warning/15">
                <Bell className="h-5 w-5 text-risk-warning" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Early Warning Center
                </h1>
                <p className="text-sm text-muted-foreground">
                  Publish, resolve, and monitor operational warnings for Bagmati Basin.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const result = await requestBrowserNotificationPermission();
                toast[result === "granted" ? "success" : "error"](
                  result === "granted" ? "Browser notifications enabled" : "Notification permission not granted",
                );
              }}
            >
              <Bell className="h-4 w-4" />
              Notifications
            </Button>
            <Button type="button" onClick={startCreate} disabled={!canManageAlerts}>
              <Plus className="h-4 w-4" />
              New Alert
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Active alerts" value={activeCount} tone={hasCritical ? "danger" : "primary"} />
          <Metric label="Database records" value={dbCount} tone="neutral" />
          <Metric label="Model signals" value={modelAlerts.length} tone="primary" />
          <Metric label="Browser status" value={permission} tone="neutral" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4 xl:col-span-2">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-foreground">Alert Operations</h2>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                  canManageAlerts
                    ? "border-risk-safe/30 bg-risk-safe/10 text-risk-safe"
                    : "border-border bg-secondary/50 text-muted-foreground",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", canManageAlerts ? "bg-risk-safe" : "bg-muted-foreground")} />
                {canManageAlerts ? "Manage mode" : "Read only"}
              </div>
            </div>

            {formOpen ? (
              <form onSubmit={submitForm} className="space-y-4 rounded-lg border border-border/70 bg-secondary/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {form.id ? "Edit Alert" : "Publish Alert"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {form.id ? "Update the active database alert." : "Create a database alert visible to staff dashboards."}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setFormOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Type">
                    <select
                      value={form.type}
                      onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as AlertType }))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    >
                      {typeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Severity">
                    <select
                      value={form.severity}
                      onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value as Severity }))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    >
                      {severityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      value={form.is_active ? "active" : "resolved"}
                      onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.value === "active" }))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    >
                      <option value="active">Active</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Title">
                    <Input
                      value={form.title}
                      onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Bagmati river warning"
                    />
                  </Field>
                  <Field label="Zone">
                    <Input
                      value={form.zone}
                      onChange={(event) => setForm((prev) => ({ ...prev, zone: event.target.value }))}
                      placeholder="Teku / Bagmati Basin"
                    />
                  </Field>
                </div>

                <Field label="Message">
                  <Textarea
                    value={form.message}
                    onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                    placeholder="Clear operational instruction for field teams and analysts."
                    rows={4}
                  />
                </Field>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saveAlert.isPending || !canManageAlerts}>
                    <Save className="h-4 w-4" />
                    {saveAlert.isPending ? "Saving..." : form.id ? "Save Changes" : "Publish Alert"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <ChannelCard
                  icon={Radio}
                  title="Dashboard Alerts"
                  description="Operational alerts are shown across the command dashboard."
                  status="active"
                />
                <ChannelCard
                  icon={Smartphone}
                  title="Browser Push"
                  description="Critical warnings can trigger local browser notifications."
                  status={permission === "granted" ? "active" : "pilot"}
                />
                <ChannelCard
                  icon={Info}
                  title="Model Signals"
                  description="ML, rainfall, gauge, and routing alerts are merged with staff records."
                  status="active"
                />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Current Posture</h3>
            <div className="space-y-2">
              <Row label="Operational mode" value={hasCritical ? "Escalated" : "Monitoring"} />
              <Row label="Forecast horizon" value="24-48 hours" />
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
              <div className="mb-3 rounded-lg border border-border p-4 text-sm text-muted-foreground">
                Loading alerts...
              </div>
            ) : error ? (
              <div className="mb-3 rounded-lg border border-risk-warning/40 bg-risk-warning/10 p-4 text-sm text-risk-warning">
                Could not load database alerts. Showing model-generated alerts only.
              </div>
            ) : null}
            <AlertFeed alerts={mergedAlerts} />
          </div>

          <div className="space-y-3 xl:col-span-2">
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search alerts by zone, severity, or message"
                  className="pl-9"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="resolved">Resolved only</option>
              </select>
            </div>

            {filteredAlerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <RiskLevelBadge level={alert.severity} />
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          alert.is_active
                            ? "bg-risk-safe/15 text-risk-safe"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {alert.is_active ? "Active" : "Resolved"}
                      </span>
                      <span className="rounded-full bg-ocean-400/10 px-2 py-0.5 text-[10px] text-ocean-400">
                        {alert.source === "model" ? "ML Engine" : "Database"}
                      </span>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">{alert.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.message}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{alert.zone}</span>
                      <span>{new Date(alert.timestamp).toLocaleString()}</span>
                      <span className="capitalize">{alert.type}</span>
                    </div>
                  </div>

                  {alert.source === "database" && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canManageAlerts}
                        onClick={() => startEdit(alert)}
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant={alert.is_active ? "secondary" : "outline"}
                        size="sm"
                        disabled={!canManageAlerts || toggleAlert.isPending}
                        onClick={() => toggleAlert.mutate({ id: alert.id, isActive: !alert.is_active })}
                      >
                        {alert.is_active ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        {alert.is_active ? "Resolve" : "Reactivate"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredAlerts.length === 0 && (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No alerts match the current filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "primary" | "danger" | "neutral";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 truncate text-xl font-bold text-foreground",
          tone === "primary" && "text-ocean-400",
          tone === "danger" && "text-risk-evacuate",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
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
    <div className="rounded-lg border border-border/70 bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-ocean-400" />
          <span className="truncate text-xs font-semibold text-foreground">{title}</span>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px]",
            status === "active" ? "bg-risk-safe/15 text-risk-safe" : "bg-risk-watch/15 text-risk-watch",
          )}
        >
          {status}
        </span>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
